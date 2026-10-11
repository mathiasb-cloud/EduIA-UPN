// EduIA-UPN · Lectura de contexto en Blackboard Ultra.
// Obtiene el texto COMPLETO de la página (sin depender del scroll), el archivo abierto,
// el curso, el alumno y las próximas fechas de entrega usando la sesión del propio alumno.
(() => {
  const API_BB = "/learn/api/public";
  const MAX_TEXTO = 40_000;
  const MAX_BYTES_DOCUMENTO = 25 * 1024 * 1024;
  const RE_ARCHIVO = /\.(pdf|docx|pptx|txt)(\?|$)/i;
  const RE_MIME = /pdf|wordprocessingml|presentationml|text\/plain/i;
  const cache = new Map();

  function memo(clave, crear) {
    if (!cache.has(clave)) {
      cache.set(clave, crear().catch((error) => {
        cache.delete(clave);
        throw error;
      }));
    }
    return cache.get(clave);
  }

  // Ultra carga su aplicación desde un CDN con <base>: sin el dominio explícito, "/learn/api/..."
  // terminaría en ultra.content.blackboardcdn.com (403). Todo se resuelve contra upn.blackboard.com.
  const absoluta = (ruta) => new URL(ruta, location.origin);

  async function getJson(ruta) {
    const respuesta = await fetch(absoluta(ruta), { credentials: "include", headers: { Accept: "application/json" } });
    if (!respuesta.ok) throw new Error(`${respuesta.status} ${ruta}`);
    return respuesta.json();
  }

  async function enviarAlServicio(mensaje) {
    try {
      return await chrome.runtime.sendMessage(mensaje);
    } catch {
      throw new Error("La extensión se actualizó. Recarga la página de Blackboard.");
    }
  }

  const capitalizar = (texto) => texto.toLowerCase().replace(/(^|\s)\p{L}/gu, (letra) => letra.toUpperCase());

  function idsDeUrl(url = location.href) {
    return {
      curso: url.match(/\/courses\/(_\d+_\d+)/)?.[1] || null,
      contenido: url.match(/\/(?:file|document|folder|assessment|contents?|item)\/(_\d+_\d+)/)?.[1] || null,
    };
  }

  function evaluacionEnCurso() {
    const enIntento = /\/attempt\/_\d+/.test(location.pathname);
    const botonEnviar = [...document.querySelectorAll("button")].some((b) => /^(enviar|entregar|submit)$/i.test(b.innerText.trim()));
    const temporizador = /tiempo restante|time remaining|intento en curso/i.test(document.body.innerText.slice(0, 15_000));
    return (enIntento && botonEnviar) || temporizador;
  }

  function tipoPagina() {
    const ruta = location.pathname + location.search;
    if (evaluacionEnCurso()) return "evaluacion";
    if (/\/(file|document)\/_\d+|bbcswebdav/i.test(ruta) || document.querySelector('iframe[src*="bbcswebdav"], embed[type="application/pdf"]')) return "archivo";
    if (/\/(assessment|assignment|test)\b/i.test(ruta)) return "actividad";
    if (/discussion/i.test(ruta)) return "debate";
    if (/grades|gradebook/i.test(ruta)) return "calificaciones";
    if (/calendar/i.test(ruta)) return "calendario";
    if (/messages/i.test(ruta)) return "mensajes";
    if (/announcement/i.test(ruta)) return "anuncios";
    if (/\/courses\/_\d+_\d+/.test(ruta)) return "curso";
    if (/\/course/i.test(ruta)) return "cursos";
    if (/institution-page|stream|activity/i.test(ruta)) return "inicio";
    return "otro";
  }

  function rutaDeNavegacion() {
    const nodos = document.querySelectorAll(
      'nav[aria-label*="breadcrumb" i] li, nav[aria-label*="ruta" i] li, [class*="breadcrumb" i] a, [class*="breadcrumb" i] li'
    );
    const textos = [...new Set([...nodos].map((n) => n.innerText.replace(/\s+/g, " ").trim()).filter(Boolean))];
    return textos.join(" › ").slice(0, 400);
  }

  // innerText incluye todo lo renderizado aunque esté fuera de pantalla: no hace falta hacer scroll.
  function textoCompleto(excluir) {
    const partes = [];
    for (const hijo of document.body.children) {
      if (hijo === excluir || ["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(hijo.tagName)) continue;
      partes.push(hijo.innerText || "");
    }
    for (const iframe of document.querySelectorAll("iframe")) {
      try {
        if (iframe.contentDocument?.body) partes.push(iframe.contentDocument.body.innerText);
      } catch {
        // iframe de otro dominio: no accesible
      }
    }
    const vistas = new Set();
    const lineas = [];
    for (const bruta of partes.join("\n").split("\n")) {
      const linea = bruta.replace(/\s+/g, " ").trim();
      if (!linea || (linea.length < 80 && vistas.has(linea))) continue; // quita menús y botones repetidos
      vistas.add(linea);
      lineas.push(linea);
    }
    return lineas.join("\n").slice(0, MAX_TEXTO);
  }

  const nombreDeUrl = (url) => decodeURIComponent(new URL(url, location.href).pathname.split("/").pop() || "documento");

  async function documentoAbierto() {
    const { curso, contenido } = idsDeUrl();
    if (curso && contenido && /\/(file|document)\//.test(location.pathname)) {
      try {
        const base = `${API_BB}/v1/courses/${curso}/contents/${contenido}/attachments`;
        const { results = [] } = await getJson(base);
        const adjunto = results.find((a) => RE_ARCHIVO.test(a.fileName || "") || RE_MIME.test(a.mimeType || ""));
        if (adjunto) return { url: `${base}/${adjunto.id}/download`, nombre: adjunto.fileName, mime: adjunto.mimeType || "" };
      } catch {
        // sin permiso para la API: se prueba con el visor
      }
    }

    const incrustado = document.querySelector('iframe[src*="bbcswebdav"], iframe[src*=".pdf" i], embed[src], object[data]');
    const fuente = incrustado?.src || incrustado?.data;
    if (fuente && (RE_ARCHIVO.test(fuente) || /bbcswebdav/i.test(fuente))) return { url: fuente, nombre: nombreDeUrl(fuente) };

    if (tipoPagina() !== "archivo") return null;
    const recurso = performance
      .getEntriesByType("resource")
      .map((e) => e.name)
      .reverse()
      .find((n) => /bbcswebdav|\/attachments\/[^/]+\/download/i.test(n) || RE_ARCHIVO.test(n));
    return recurso ? { url: recurso, nombre: nombreDeUrl(recurso) } : null;
  }

  function aBase64(blob) {
    return new Promise((resolver, rechazar) => {
      const lector = new FileReader();
      lector.onload = () => resolver(String(lector.result).split(",")[1]);
      lector.onerror = rechazar;
      lector.readAsDataURL(blob);
    });
  }

  class ArchivoMuyGrande extends Error {}

  // isInlineRender=true hace que Blackboard redirija a su visor de documentos en lugar de al archivo.
  function urlDeArchivo(url) {
    const direccion = absoluta(url);
    direccion.searchParams.delete("isInlineRender");
    return direccion.href;
  }

  async function subirDesdeLaPagina(url, doc) {
    const archivo = await fetch(url, { credentials: "include" });
    if (!archivo.ok) return null;
    const blob = await archivo.blob();
    if (blob.size > MAX_BYTES_DOCUMENTO) throw new ArchivoMuyGrande("El archivo es muy grande para leerlo completo (máx. 25 MB).");
    return enviarAlServicio({ tipo: "documento", base64: await aBase64(blob), nombre: doc.nombre, mime: blob.type || doc.mime });
  }

  function subirDocumento(doc) {
    const url = urlDeArchivo(doc.url);
    return memo(`doc:${url}`, async () => {
      let respuesta = null;
      if (new URL(url).origin === location.origin) {
        try {
          respuesta = await subirDesdeLaPagina(url, doc);
        } catch (error) {
          if (error instanceof ArchivoMuyGrande) throw error;
          // Blackboard redirigió a su CDN o a su visor (otro dominio, sin CORS): lo descarga el service worker.
        }
      }
      if (!respuesta?.ok) respuesta = await enviarAlServicio({ tipo: "documento", url, nombre: doc.nombre, mime: doc.mime });
      if (!respuesta?.ok) {
        const motivo = respuesta?.datos?.detail || respuesta?.error || (respuesta?.status ? `Blackboard respondió ${respuesta.status}` : "");
        throw new Error(motivo || "No pude leer el archivo.");
      }
      return respuesta.datos;
    });
  }

  function nombreCurso(cursoId) {
    return memo(`curso:${cursoId}`, async () => {
      for (const version of ["v3", "v1"]) {
        try {
          return (await getJson(`${API_BB}/${version}/courses/${cursoId}?fields=name`)).name || "";
        } catch {
          // se intenta la siguiente versión
        }
      }
      return "";
    });
  }

  function alumno() {
    return memo("alumno", async () => {
      const yo = await getJson(`${API_BB}/v1/users/me?fields=id,userName,name`);
      return { id: yo.id, nombre: capitalizar((yo.name?.given || "").split(" ")[0] || "") };
    });
  }

  const formatearFecha = (iso) =>
    new Date(iso).toLocaleString("es-PE", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  function proximasEntregas(dias = 21) {
    return memo(`entregas:${new Date().toDateString()}`, async () => {
      const q = new URLSearchParams({ since: new Date().toISOString(), until: new Date(Date.now() + dias * 864e5).toISOString() });
      const rutas = [`${API_BB}/v1/calendars/items?${q}&sort=start&limit=100`, `/learn/api/v1/calendars/dueDateCalendarItems?${q}`];
      for (const ruta of rutas) {
        try {
          const { results = [] } = await getJson(ruta);
          return results
            .map((item) => ({
              titulo: item.title || item.name || "Actividad",
              curso: item.calendarName || item.calendarNameLocalized || "",
              fechaIso: item.end || item.start || item.dueDate,
            }))
            .filter((e) => e.fechaIso && new Date(e.fechaIso) > new Date())
            .sort((a, b) => new Date(a.fechaIso) - new Date(b.fechaIso))
            .map((e) => ({ ...e, fecha: formatearFecha(e.fechaIso) }));
        } catch {
          // se intenta la siguiente ruta
        }
      }
      return null;
    });
  }

  /** Lee todo lo que EduIA necesita saber de la página actual. */
  async function leer({ excluir, conDocumento = true } = {}) {
    const info = {
      url: location.href,
      titulo: (document.querySelector("h1")?.innerText || document.title || "").trim().slice(0, 200),
      tipo_pagina: tipoPagina(),
      ruta: rutaDeNavegacion(),
      texto_pagina: textoCompleto(excluir),
      evaluacion_en_curso: evaluacionEnCurso(),
      curso: "",
      documento: null,
      error_documento: "",
    };
    const { curso } = idsDeUrl();
    await Promise.all([
      curso ? nombreCurso(curso).then((nombre) => (info.curso = nombre)).catch(() => {}) : null,
      conDocumento
        ? documentoAbierto()
            .then((doc) => doc && subirDocumento(doc))
            .then((doc) => (info.documento = doc || null))
            .catch((error) => (info.error_documento = error.message))
        : null,
    ]);
    return info;
  }

  function olvidarDocumentos() {
    for (const clave of cache.keys()) if (clave.startsWith("doc:")) cache.delete(clave);
  }

  globalThis.EduContexto = { leer, alumno, proximasEntregas, tipoPagina, formatearFecha, olvidarDocumentos };
})();
