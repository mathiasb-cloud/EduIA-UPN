// EduIA-UPN · service worker: puente entre la página de Blackboard y la API de EduIA.
// Las llamadas pasan por aquí para evitar bloqueos de CORS/red local desde la página.

const API_POR_DEFECTO = "http://localhost:8000";

async function urlApi() {
  const { ajustes } = await chrome.storage.local.get("ajustes");
  return (ajustes?.servidor || API_POR_DEFECTO).replace(/\/+$/, "");
}

// Chat en streaming: la API responde NDJSON y reenviamos cada evento por el puerto.
chrome.runtime.onConnect.addListener((puerto) => {
  if (puerto.name !== "eduia-chat") return;
  const control = new AbortController();
  puerto.onDisconnect.addListener(() => control.abort());

  puerto.onMessage.addListener(async (solicitud) => {
    try {
      const respuesta = await fetch(`${await urlApi()}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(solicitud),
        signal: control.signal,
      });
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

      const lector = respuesta.body.pipeThrough(new TextDecoderStream()).getReader();
      let pendiente = "";
      for (;;) {
        const { value, done } = await lector.read();
        if (done) break;
        pendiente += value;
        const lineas = pendiente.split("\n");
        pendiente = lineas.pop();
        for (const linea of lineas) if (linea.trim()) puerto.postMessage(JSON.parse(linea));
      }
      if (pendiente.trim()) puerto.postMessage(JSON.parse(pendiente));
    } catch (error) {
      if (control.signal.aborted) return;
      puerto.postMessage({
        t: "error",
        v: "No pude conectar con el servidor de EduIA. Verifica que esté encendido (uvicorn api:app).",
        tecnico: String(error),
      });
    }
  });
});

chrome.runtime.onMessage.addListener((mensaje, _remitente, responder) => {
  const acciones = { api: llamarApi, documento: leerDocumento };
  const accion = acciones[mensaje?.tipo];
  if (!accion) return false;
  accion(mensaje).then(responder, (error) => responder({ ok: false, error: String(error?.message || error) }));
  return true; // respuesta asíncrona
});

async function llamarApi({ metodo = "GET", ruta, cuerpo }) {
  const respuesta = await fetch(`${await urlApi()}${ruta}`, {
    method: metodo,
    headers: cuerpo ? { "Content-Type": "application/json" } : undefined,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return { ok: respuesta.ok, status: respuesta.status, datos: await respuesta.json().catch(() => null) };
}

function nombreDesdeCabecera(cabecera) {
  if (!cabecera) return "";
  const utf8 = cabecera.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8) return decodeURIComponent(utf8[1]);
  return cabecera.match(/filename="?([^";]+)"?/i)?.[1] || "";
}

const VISOR_BLACKBOARD = /^basic-doc-viewer\..+\.blackboard\.com$/i;

// Blackboard entrega los archivos redirigiendo a su CDN (content.blackboardcdn.com) o a su visor
// (basic-doc-viewer…blackboard.com). Desde aquí no aplica CORS gracias a host_permissions.
async function descargarDeBlackboard(url) {
  let archivo = await fetch(url, { credentials: "include" });
  const destino = new URL(archivo.url);
  const firmada = destino.searchParams.get("url");
  if (VISOR_BLACKBOARD.test(destino.hostname) && firmada) {
    archivo = await fetch(firmada); // el visor recibe el enlace firmado del archivo real
  }
  return archivo;
}

// Envía a la API el archivo abierto en Blackboard para extraer su texto completo (sin hacer scroll).
// Si la página ya lo descargó llega en base64; si no, lo descargamos con la sesión del alumno.
async function leerDocumento({ url, nombre = "", mime = "", base64 }) {
  let bytes;
  if (base64) {
    bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  } else {
    const archivo = await descargarDeBlackboard(url);
    if (!archivo.ok) return { ok: false, status: archivo.status };
    mime = archivo.headers.get("content-type") || mime;
    nombre = nombre || nombreDesdeCabecera(archivo.headers.get("content-disposition")) || "documento";
    bytes = await archivo.arrayBuffer();
  }
  const parametros = new URLSearchParams({ nombre, mime });
  return llamarApiBinaria(`/documentos?${parametros}`, bytes);
}

async function llamarApiBinaria(ruta, bytes) {
  const respuesta = await fetch(`${await urlApi()}${ruta}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: bytes,
  });
  return { ok: respuesta.ok, status: respuesta.status, datos: await respuesta.json().catch(() => null) };
}
