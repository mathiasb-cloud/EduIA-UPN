// EduIA-UPN · Widget del tutor dentro de Blackboard: burbuja, chat en streaming, contexto y recordatorios.
(() => {
  if (window.top !== window || document.getElementById("eduia-raiz")) return;

  const { el, icono, quiz, tarjetaRecordatorio, toast } = globalThis.EduUI;
  const { renderizar } = globalThis.EduMarkdown;
  const Ctx = globalThis.EduContexto;

  const MAX_MENSAJES_GUARDADOS = 40;
  const VIGENCIA_CONVERSACION_MS = 24 * 36e5;
  const RE_PLANIFICAR = /pendiente|entrega|vence|semana|calendario|organiza|planific|examen|t[1-4]\b/i;
  const REDUCIR_MOVIMIENTO = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const SUGERENCIAS = {
    archivo: [
      ["🧭", "¿Por dónde empiezo?", "Un plan paso a paso", "¿Por dónde empiezo con este documento? Dame un plan sin resolverlo por mí."],
      ["📄", "Resúmelo", "Ideas clave en 1 minuto", "Resúmeme este documento en ideas clave."],
      ["🧠", "Explícame los conceptos", "Con ejemplos simples", "Explícame los conceptos principales de este documento con ejemplos simples."],
      ["📝", "Ponme a prueba", "Quiz interactivo", "Hazme un quiz sobre este documento."],
    ],
    actividad: [
      ["🎯", "¿Qué me piden?", "Entiende la consigna", "Explícame qué me piden en esta actividad y cómo organizarme."],
      ["🧭", "Plan de trabajo", "Pasos y tiempos", "Ayúdame a armar un plan de trabajo para esta actividad."],
      ["📤", "¿Cómo la entrego?", "Paso a paso en Blackboard", "¿Cómo entrego esta actividad en Blackboard?"],
      ["⏰", "Recuérdamela", "Aviso por WhatsApp", "Recuérdame esta entrega un día antes a las 8 pm."],
    ],
    evaluacion: [
      ["🔒", "Problema técnico", "Solo ayuda con la plataforma", "Tengo un problema técnico con la evaluación, ¿qué hago?"],
      ["🎥", "Cámara o SUMADI", "Solución rápida", "Mi cámara o SUMADI no funciona, ¿qué hago?"],
    ],
    otro: [
      ["🗺️", "¿Dónde veo mis notas?", "Te guío paso a paso", "¿Dónde veo mis notas en Blackboard?"],
      ["📅", "¿Qué tengo pendiente?", "Tus próximas entregas", "¿Qué tengo pendiente estas semanas?"],
      ["⏰", "Recuérdame algo", "Aviso por WhatsApp", "Quiero que me recuerdes un examen por WhatsApp."],
      ["🎥", "Entrar a mi clase", "Videoconferencias", "¿Cómo entro a mi clase virtual en Blackboard?"],
    ],
  };

  const estado = {
    abierto: false,
    expandido: false,
    modo: "rapido",
    mensajes: [],
    finalizarActual: null,
    contexto: null,
    contextoPromesa: null,
    urlContexto: "",
    alumno: { id: "", nombre: "" },
    ajustes: {},
  };

  // ---------- Estructura ----------

  const host = el("div", { id: "eduia-raiz" });
  const sombra = host.attachShadow({ mode: "open" });
  const raiz = el("div", { class: "edu" });
  sombra.append(el("style", {}, globalThis.EDU_ESTILOS), raiz);

  const punto = el("span", { class: "edu-burbuja-punto", hidden: true });
  const burbuja = el(
    "button",
    { class: "edu-burbuja", type: "button", "aria-label": "Abrir EduIA, tu tutor", "aria-expanded": "false", title: "EduIA · Tu tutor en Blackboard" },
    el("span", { class: "edu-burbuja-halo" }),
    el("span", { class: "edu-burbuja-icono edu-icono-abrir", html: icono("birrete", 28) }),
    el("span", { class: "edu-burbuja-icono edu-icono-cerrar", html: icono("abajo", 26) }),
    punto
  );

  const saludoTexto = el("div");
  const saludo = el(
    "div",
    { class: "edu-saludo", role: "status", hidden: true },
    saludoTexto,
    el("button", { class: "edu-saludo-cerrar", type: "button", "aria-label": "Cerrar saludo" }, "×")
  );

  const botonIcono = (accion, nombre, titulo) =>
    el("button", { class: "edu-boton-icono", type: "button", "data-accion": accion, title: titulo, "aria-label": titulo, html: icono(nombre, 18) });
  const contador = el("span", { class: "edu-contador", hidden: true });
  const botonRecordatorios = botonIcono("recordatorios", "campana", "Recordatorios");
  botonRecordatorios.append(contador);
  const botonExpandir = botonIcono("expandir", "expandir", "Maximizar");
  const estadoCabecera = el("div", { class: "edu-estado" }, "En línea · listo para ayudarte");

  const contextoIcono = el("span", { class: "edu-contexto-icono" });
  const contextoTexto = el("span", { class: "edu-contexto-texto" }, "Leyendo esta página…");
  const barraContexto = el(
    "div",
    { class: "edu-contexto", "data-estado": "leyendo" },
    contextoIcono,
    contextoTexto,
    el("button", { class: "edu-contexto-recargar", type: "button", "data-accion": "releer", title: "Volver a leer la página", "aria-label": "Volver a leer la página", html: icono("recargar", 14) })
  );

  const lista = el("div", { class: "edu-lista" });
  const mensajes = el("div", { class: "edu-mensajes", role: "log", "aria-live": "polite" }, lista);
  const irAbajo = el("button", { class: "edu-ir-abajo", type: "button", hidden: true }, "↓ Nuevo mensaje");

  const entrada = el("textarea", { class: "edu-entrada", rows: 1, placeholder: "Pregúntale a EduIA sobre esta página…", "aria-label": "Escribe tu mensaje" });
  const botonEnviar = el("button", { class: "edu-enviar", type: "button", "aria-label": "Enviar", disabled: true, html: icono("enviar", 18) });
  const Reconocimiento = window.SpeechRecognition || window.webkitSpeechRecognition;
  const botonMicrofono = Reconocimiento ? el("button", { class: "edu-boton-icono edu-microfono", type: "button", title: "Dictar por voz", "aria-label": "Dictar por voz", html: icono("microfono", 18) }) : null;
  const botonesModo = [
    el("button", { class: "edu-modo", type: "button", role: "radio", "data-modo": "rapido", title: "Respuestas inmediatas" }, "⚡ Rápido"),
    el("button", { class: "edu-modo", type: "button", role: "radio", "data-modo": "profundo", title: "Analiza con más detalle, incluso diagramas (más lento)" }, "🧠 Profundo"),
  ];

  const panel = el(
    "section",
    { class: "edu-panel", role: "dialog", "aria-label": "EduIA, tutor académico", hidden: true },
    el(
      "header",
      { class: "edu-cabecera" },
      el("div", { class: "edu-avatar", html: icono("birrete", 22) }, el("span", { class: "edu-en-linea" })),
      el("div", { class: "edu-cabecera-textos" }, el("div", { class: "edu-titulo" }, "EduIA", el("span", { class: "edu-insignia" }, "UPN")), estadoCabecera),
      el(
        "div",
        { class: "edu-acciones" },
        botonRecordatorios,
        botonIcono("nuevo", "nuevo", "Nueva conversación"),
        botonIcono("ajustes", "ajustes", "Ajustes"),
        botonExpandir,
        botonIcono("minimizar", "minimizar", "Minimizar")
      )
    ),
    barraContexto,
    el("div", { class: "edu-cuerpo" }, mensajes, irAbajo),
    el(
      "footer",
      { class: "edu-compositor" },
      el(
        "div",
        { class: "edu-caja" },
        entrada,
        el(
          "div",
          { class: "edu-caja-barra" },
          el("div", { class: "edu-modos", role: "radiogroup", "aria-label": "Modo de respuesta" }, botonesModo),
          el("div", { class: "edu-caja-derecha" }, botonMicrofono, botonEnviar)
        )
      ),
      el("div", { class: "edu-pie" }, "EduIA te guía, no hace tu tarea · Verifica la información importante")
    )
  );

  const menuSeleccion = el(
    "div",
    { class: "edu-seleccion", hidden: true },
    el("button", { type: "button", "data-accion": "explicar-seleccion" }, "✨ Explícame esto"),
    el("button", { type: "button", "data-accion": "preguntar-seleccion" }, "💬 Preguntar")
  );

  raiz.append(saludo, panel, burbuja, menuSeleccion);

  // ---------- Utilidades ----------

  const nombreAlumno = () => estado.ajustes.nombre || estado.alumno.nombre || "";
  const avisar = (texto) => toast(panel, texto);
  const conLimite = (promesa, ms) => Promise.race([promesa, new Promise((resolver) => setTimeout(() => resolver(undefined), ms))]);

  function animar(nodo, cuadros, opciones) {
    nodo._animacion?.cancel();
    nodo._animacion = nodo.animate(cuadros, REDUCIR_MOVIMIENTO ? { ...opciones, duration: 1, delay: 0 } : opciones);
    return nodo._animacion.finished.catch(() => {});
  }

  async function api(metodo, ruta, cuerpo) {
    try {
      return await chrome.runtime.sendMessage({ tipo: "api", metodo, ruta, cuerpo });
    } catch {
      return { ok: false, datos: { detail: "La extensión se actualizó: recarga la página." } };
    }
  }

  let pegadoAbajo = true;
  mensajes.addEventListener(
    "scroll",
    () => {
      pegadoAbajo = mensajes.scrollHeight - mensajes.scrollTop - mensajes.clientHeight < 80;
      if (pegadoAbajo) irAbajo.hidden = true;
    },
    { passive: true }
  );

  function desplazarAbajo(forzar = false) {
    if (forzar || pegadoAbajo) {
      mensajes.scrollTo({ top: mensajes.scrollHeight, behavior: "instant" });
      pegadoAbajo = true;
    } else {
      irAbajo.hidden = false;
    }
  }

  // ---------- Abrir, cerrar y maximizar ----------

  function abrir({ enfocar = true } = {}) {
    if (estado.abierto) return;
    estado.abierto = true;
    ocultarSaludo();
    panel.hidden = false;
    punto.hidden = true;
    burbuja.setAttribute("aria-expanded", "true");
    burbuja.setAttribute("aria-label", "Minimizar EduIA");
    burbuja.classList.remove("edu-burbuja--atencion");
    burbuja.classList.toggle("edu-burbuja--oculta", estado.expandido);
    panel.classList.add("edu-panel--entrando");
    animar(
      panel,
      [
        { opacity: 0, transform: "translate(12px, 24px) scale(.72)", filter: "blur(6px)" },
        { opacity: 1, transform: "none", filter: "blur(0)" },
      ],
      { duration: 520, easing: "cubic-bezier(.16, 1, .3, 1)" }
    ).then(() => panel.classList.remove("edu-panel--entrando"));
    sessionStorage.setItem("eduia-abierto", "1");
    prepararContexto();
    desplazarAbajo(true);
    if (enfocar) setTimeout(() => entrada.focus({ preventScroll: true }), 140);
  }

  function cerrar() {
    if (!estado.abierto) return;
    estado.abierto = false;
    burbuja.setAttribute("aria-expanded", "false");
    burbuja.setAttribute("aria-label", "Abrir EduIA, tu tutor");
    burbuja.classList.remove("edu-burbuja--oculta");
    sessionStorage.removeItem("eduia-abierto");
    animar(
      panel,
      [
        { opacity: 1, transform: "none", filter: "blur(0)" },
        { opacity: 0, transform: "translate(14px, 20px) scale(.78)", filter: "blur(4px)" },
      ],
      { duration: 260, easing: "cubic-bezier(.4, 0, 1, 1)" }
    ).then(() => {
      if (!estado.abierto) panel.hidden = true;
    });
    animar(burbuja, [{ transform: "scale(1)" }, { transform: "scale(1.14)", offset: 0.5 }, { transform: "scale(1)" }], {
      duration: 460,
      delay: 170,
      easing: "cubic-bezier(.34, 1.56, .64, 1)",
    });
  }

  function alternarExpandido(forzar) {
    estado.expandido = forzar ?? !estado.expandido;
    panel.classList.toggle("edu-panel--expandida", estado.expandido);
    burbuja.classList.toggle("edu-burbuja--oculta", estado.abierto && estado.expandido);
    botonExpandir.innerHTML = icono(estado.expandido ? "contraer" : "expandir", 18);
    botonExpandir.title = botonExpandir.ariaLabel = estado.expandido ? "Restaurar tamaño" : "Maximizar";
    sessionStorage.setItem("eduia-expandido", estado.expandido ? "1" : "");
  }

  // ---------- Saludo inicial ----------

  let temporizadorSaludo;
  function mostrarSaludo() {
    if (estado.abierto || estado.ajustes.saludo === false || sessionStorage.getItem("eduia-saludado")) return;
    const tipo = Ctx.tipoPagina();
    if (tipo === "evaluacion") return;
    sessionStorage.setItem("eduia-saludado", "1");
    const invitaciones = {
      archivo: "📄 ¿Te explico este documento paso a paso?",
      actividad: "📝 ¿Te ayudo a entender esta actividad?",
      calificaciones: "📊 ¿Revisamos juntos cómo vas?",
      curso: "📚 ¿Te guío en este curso?",
    };
    const nombre = nombreAlumno();
    saludoTexto.replaceChildren(el("strong", {}, `¡Hola${nombre ? `, ${nombre}` : ""}! 👋`), invitaciones[tipo] || "Soy EduIA, tu tutor en Blackboard. ¿En qué te ayudo hoy?");
    saludo.classList.remove("edu-saludo--saliendo");
    saludo.hidden = false;
    burbuja.classList.add("edu-burbuja--atencion");
    temporizadorSaludo = setTimeout(ocultarSaludo, 12_000);
  }

  function ocultarSaludo() {
    clearTimeout(temporizadorSaludo);
    burbuja.classList.remove("edu-burbuja--atencion");
    if (saludo.hidden) return;
    saludo.classList.add("edu-saludo--saliendo");
    setTimeout(() => (saludo.hidden = true), 260);
  }

  // ---------- Contexto de la página ----------

  function pintarContexto(estadoContexto, texto, nombreIcono) {
    barraContexto.dataset.estado = estadoContexto;
    contextoIcono.innerHTML = nombreIcono ? icono(nombreIcono, 14) : "";
    contextoTexto.textContent = texto;
    contextoTexto.title = texto;
    estadoCabecera.textContent = estadoContexto === "leyendo" ? "Leyendo la página…" : "En línea · listo para ayudarte";
  }

  function pintarContextoListo(info) {
    if (info.evaluacion_en_curso) return pintarContexto("aviso", "Evaluación en curso · solo ayuda técnica (integridad académica)", "candado");
    if (info.documento) {
      const unidad = info.documento.tipo === "pptx" ? "diapositivas" : "págs.";
      return pintarContexto("listo", `${info.documento.nombre} · ${info.documento.paginas} ${unidad} leídas completas`, "documento");
    }
    if (info.error_documento) return pintarContexto("aviso", `Leí la página, pero no el archivo: ${info.error_documento}`, "documento");
    pintarContexto("listo", `Viendo: ${info.curso || info.titulo || "esta página"}`, info.curso ? "libro" : "brujula");
  }

  function prepararContexto({ forzar = false } = {}) {
    if (!forzar && estado.contextoPromesa && estado.urlContexto === location.href) return estado.contextoPromesa;
    estado.urlContexto = location.href;
    pintarContexto("leyendo", "Leyendo esta página completa…");
    estado.contextoPromesa = Ctx.leer({ excluir: host, conDocumento: estado.ajustes.leerDocumentos !== false })
      .then((info) => {
        estado.contexto = info;
        pintarContextoListo(info);
        return info;
      })
      .catch(() => {
        pintarContexto("error", "No pude leer esta página, pero puedo ayudarte igual");
        return null;
      });
    return estado.contextoPromesa;
  }

  const debePrecargar = () => estado.ajustes.leerDocumentos !== false && /\/(file|document)\/_\d+/.test(location.pathname);

  // Blackboard Ultra cambia de página sin recargar: se detecta el cambio de URL.
  let ultimaUrl = location.href;
  let temporizadorNavegacion;
  setInterval(() => {
    if (location.href === ultimaUrl) return;
    ultimaUrl = location.href;
    estado.contextoPromesa = null;
    clearTimeout(temporizadorNavegacion);
    temporizadorNavegacion = setTimeout(() => {
      if (estado.abierto || debePrecargar()) prepararContexto();
      if (!estado.mensajes.length) pintarBienvenida();
    }, 1200);
  }, 700);

  // ---------- Mensajes ----------

  function pintarBienvenida() {
    const nombre = nombreAlumno();
    const tarjetas = SUGERENCIAS[Ctx.tipoPagina()] || SUGERENCIAS.otro;
    lista.replaceChildren(
      el(
        "div",
        { class: "edu-bienvenida" },
        el("div", { class: "edu-bienvenida-avatar", html: icono("birrete", 32) }, el("span", { class: "edu-mano" }, "👋")),
        el("h2", {}, `¡Hola${nombre ? `, ${nombre}` : ""}!`),
        el("p", {}, "Soy EduIA, tu tutor en Blackboard. Leo lo que tienes en pantalla, te explico con pistas y te recuerdo tus entregas por WhatsApp. ¿Por dónde empezamos?"),
        el(
          "div",
          { class: "edu-tarjetas" },
          tarjetas.map(([emoji, titulo, detalle, pregunta], i) =>
            el(
              "button",
              { class: "edu-tarjeta", type: "button", style: `--i:${i}`, onclick: () => enviar(pregunta) },
              el("span", { class: "edu-tarjeta-emoji" }, emoji),
              el("span", {}, el("strong", {}, titulo), el("small", {}, detalle))
            )
          )
        ),
        el(
          "button",
          { class: "edu-enlace-cachimbo", type: "button", onclick: () => enviar("Soy cachimbo y es mi primera vez en Blackboard UPN. Explícame lo esencial en 5 pasos.") },
          "¿Eres cachimbo? Aprende Blackboard en 2 minutos →"
        )
      )
    );
  }

  function agregarUsuario(texto, cita = "") {
    lista.querySelector(".edu-bienvenida")?.remove();
    const nodo = el(
      "div",
      { class: "edu-msj edu-msj-usuario" },
      el("div", { class: "edu-burbuja-usuario" }, cita ? el("span", { class: "edu-cita" }, `«${cita.length > 140 ? `${cita.slice(0, 140)}…` : cita}»`) : null, texto)
    );
    lista.append(nodo);
    desplazarAbajo(true);
    return nodo;
  }

  function crearMensajeBot() {
    const md = el("div", { class: "edu-md" });
    const contenido = el("div", { class: "edu-msj-contenido" }, md);
    const nodo = el("div", { class: "edu-msj edu-msj-bot" }, el("div", { class: "edu-msj-avatar", html: icono("birrete", 15) }), contenido);
    lista.append(nodo);
    return { nodo, md, contenido };
  }

  function pintarRespuesta(vista, texto, { enStreaming }) {
    const { html, quizzes, sugerencias } = renderizar(texto, { enStreaming });
    vista.md.innerHTML = html;
    vista.md.classList.toggle("edu-md--streaming", enStreaming);
    vista.md.querySelectorAll(".edu-quiz[data-quiz]").forEach((hueco) => {
      if (enStreaming) {
        hueco.replaceWith(el("div", { class: "edu-quiz-cargando" }, el("span", { class: "edu-spinner" }), "Preparando tu quiz…"));
        return;
      }
      hueco.replaceWith(
        quiz(quizzes[Number(hueco.dataset.quiz)], {
          alCambiar: () => desplazarAbajo(),
          alTerminar: ({ repasar }) => repasar && enviar(`En el quiz fallé estas preguntas, explícamelas con pistas: ${repasar.map((p) => `«${p}»`).join("; ")}`),
        })
      );
    });
    return sugerencias;
  }

  function pintarSugerencias(vista, sugerencias) {
    lista.querySelectorAll(".edu-sugerencias").forEach((s) => s.remove());
    if (!sugerencias.length) return;
    vista.contenido.append(
      el(
        "div",
        { class: "edu-sugerencias" },
        sugerencias.slice(0, 3).map((texto, i) => el("button", { class: "edu-chip", type: "button", style: `--i:${i}`, onclick: () => enviar(texto) }, texto))
      )
    );
  }

  function accionesMensaje(vista, texto, meta = {}) {
    const copiar = el("button", { type: "button", title: "Copiar respuesta" }, "Copiar");
    copiar.addEventListener("click", async () => {
      await navigator.clipboard.writeText(texto.replace(/\[\[[^\]]*\]\]/g, "").trim());
      copiar.textContent = "¡Copiado!";
      setTimeout(() => (copiar.textContent = "Copiar"), 1500);
    });
    const valorar = (util) => {
      const boton = el("button", { type: "button", "aria-pressed": "false", title: util ? "Me sirvió" : "No me sirvió" }, util ? "👍" : "👎");
      boton.addEventListener("click", () => {
        boton.parentElement.querySelectorAll("[aria-pressed]").forEach((b) => b.setAttribute("aria-pressed", "false"));
        boton.setAttribute("aria-pressed", "true");
        api("POST", "/valoraciones", { util, modelo: meta.modelo || "", tipo_pagina: estado.contexto?.tipo_pagina || "" });
        avisar(util ? "¡Gracias! Me alegra ayudarte 🙌" : "Gracias, lo tendremos en cuenta para mejorar");
      });
      return boton;
    };
    vista.contenido.append(
      el(
        "div",
        { class: "edu-msj-acciones" },
        copiar,
        valorar(true),
        valorar(false),
        meta.ms_total ? el("span", { class: "edu-msj-meta", title: `Modelo: ${meta.modelo}` }, `${(meta.ms_total / 1000).toFixed(1)} s`) : null
      )
    );
  }

  async function cancelarRecordatorio(rec) {
    const r = await api("DELETE", `/recordatorios/${rec.id}?alumno=${encodeURIComponent(estado.alumno.id)}`);
    avisar(r.ok ? "Recordatorio cancelado" : `⚠️ ${r.datos?.detail || "No se pudo cancelar"}`);
    refrescarContador();
    return r.ok;
  }

  function pintarContador(pendientes) {
    contador.hidden = !pendientes;
    contador.textContent = pendientes > 9 ? "9+" : String(pendientes);
  }

  async function refrescarContador() {
    if (!estado.alumno.id) return;
    const r = await api("GET", `/recordatorios?alumno=${encodeURIComponent(estado.alumno.id)}`);
    if (r.ok) pintarContador(r.datos.filter((rec) => rec.estado === "pendiente").length);
  }

  function guardarConversacion() {
    chrome.storage.local.set({ conversacion: { mensajes: estado.mensajes.slice(-MAX_MENSAJES_GUARDADOS), actualizado: Date.now() } }).catch(() => {});
  }

  function restaurarConversacion(guardada) {
    if (!guardada?.mensajes?.length || Date.now() - guardada.actualizado > VIGENCIA_CONVERSACION_MS) return false;
    estado.mensajes = guardada.mensajes;
    lista.replaceChildren();
    for (const mensaje of estado.mensajes) {
      if (mensaje.rol === "user") {
        agregarUsuario(mensaje.texto);
      } else {
        const vista = crearMensajeBot();
        pintarRespuesta(vista, mensaje.texto, { enStreaming: false });
        accionesMensaje(vista, mensaje.texto);
      }
    }
    return true;
  }

  function nuevaConversacion() {
    estado.finalizarActual?.("Conversación reiniciada.");
    estado.mensajes = [];
    guardarConversacion();
    pintarBienvenida();
    avisar("✨ Nueva conversación");
    entrada.focus();
  }

  // ---------- Envío y streaming ----------

  function actualizarBotonEnviar() {
    const enCurso = Boolean(estado.finalizarActual);
    botonEnviar.classList.toggle("edu-enviar--detener", enCurso);
    botonEnviar.innerHTML = icono(enCurso ? "detener" : "enviar", 18);
    botonEnviar.ariaLabel = enCurso ? "Detener respuesta" : "Enviar";
    botonEnviar.disabled = !enCurso && !entrada.value.trim();
  }

  function autoAjustar() {
    entrada.style.height = "auto";
    entrada.style.height = `${Math.min(entrada.scrollHeight, 150)}px`;
  }

  async function construirSolicitud(texto, historial, seleccion) {
    let info = await conLimite(prepararContexto(), 8000);
    if (info === undefined) info = await Ctx.leer({ excluir: host, conDocumento: false }).catch(() => null); // el archivo sigue cargando en segundo plano
    const entregas = RE_PLANIFICAR.test(texto) ? await conLimite(Ctx.proximasEntregas().catch(() => null), 2500) : null;
    return {
      mensaje: texto,
      historial,
      modo: estado.modo,
      alumno: { id: estado.alumno.id, nombre: nombreAlumno(), whatsapp: estado.ajustes.whatsapp || "" },
      contexto: {
        url: location.href,
        titulo: info?.titulo || document.title,
        tipo_pagina: info?.tipo_pagina || "otro",
        curso: info?.curso || "",
        ruta: info?.ruta || "",
        texto_pagina: info?.texto_pagina || "",
        documento_id: info?.documento?.id || null,
        evaluacion_en_curso: Boolean(info?.evaluacion_en_curso),
        seleccion,
        entregas: (entregas || []).slice(0, 15).map(({ titulo, curso, fecha }) => ({ titulo, curso, fecha })),
      },
    };
  }

  async function enviar(textoForzado, { seleccion = "" } = {}) {
    const texto = (textoForzado ?? entrada.value).trim();
    if (!texto || estado.finalizarActual) return;
    if (!estado.abierto) abrir({ enfocar: false });
    entrada.value = "";
    autoAjustar();

    const nodoUsuario = agregarUsuario(texto, seleccion);
    const historial = estado.mensajes.slice(-12).map(({ rol, texto: t }) => ({ rol, texto: t }));
    estado.mensajes.push({ rol: "user", texto });
    guardarConversacion();

    const vista = crearMensajeBot();
    const escribiendo = el("div", { class: "edu-escribiendo", "aria-label": "EduIA está escribiendo" }, el("span"), el("span"), el("span"));
    vista.md.replaceWith(escribiendo);
    desplazarAbajo(true);

    let respuesta = "";
    let terminado = false;
    let puerto = null;
    let renderPendiente = false;

    const mostrarTexto = () => escribiendo.isConnected && escribiendo.replaceWith(vista.md);

    const finalizar = (error, meta = {}) => {
      if (terminado) return;
      terminado = true;
      estado.finalizarActual = null;
      actualizarBotonEnviar();
      try {
        puerto?.disconnect();
      } catch {
        // el puerto ya estaba cerrado
      }
      mostrarTexto();
      if (error && !respuesta) {
        vista.nodo.classList.add("edu-msj-error");
        const reintentar = el("button", { class: "edu-boton edu-boton-secundario edu-boton-mini", type: "button", style: "margin-left:8px" }, "Reintentar");
        reintentar.addEventListener("click", () => {
          vista.nodo.remove();
          nodoUsuario.remove();
          if (estado.mensajes.at(-1)?.texto === texto) estado.mensajes.pop();
          enviar(texto, { seleccion });
        });
        vista.md.replaceChildren(el("p", {}, `😕 ${error}`, reintentar));
        desplazarAbajo();
        return;
      }
      if (error) respuesta += `\n\n_${error}_`;
      const sugerencias = pintarRespuesta(vista, respuesta, { enStreaming: false });
      pintarSugerencias(vista, sugerencias);
      accionesMensaje(vista, respuesta, meta);
      estado.mensajes.push({ rol: "model", texto: respuesta });
      guardarConversacion();
      if (!estado.abierto) punto.hidden = false;
      desplazarAbajo();
    };
    estado.finalizarActual = finalizar;
    actualizarBotonEnviar();

    const solicitud = await construirSolicitud(texto, historial, seleccion);
    if (terminado) return; // se detuvo mientras se leía el contexto

    try {
      puerto = chrome.runtime.connect({ name: "eduia-chat" });
    } catch {
      finalizar("La extensión se actualizó. Recarga la página de Blackboard.");
      return;
    }

    puerto.onMessage.addListener((evento) => {
      switch (evento.t) {
        case "texto":
          mostrarTexto();
          respuesta += evento.v;
          if (!renderPendiente) {
            renderPendiente = true;
            requestAnimationFrame(() => {
              renderPendiente = false;
              if (terminado) return;
              pintarRespuesta(vista, respuesta, { enStreaming: true });
              desplazarAbajo();
            });
          }
          break;
        case "recordatorio":
          vista.contenido.append(tarjetaRecordatorio(evento.v, { alCancelar: cancelarRecordatorio }));
          refrescarContador();
          desplazarAbajo();
          break;
        case "recordatorio_cancelado":
          refrescarContador();
          break;
        case "documento_perdido":
          Ctx.olvidarDocumentos();
          estado.contextoPromesa = null;
          break;
        case "error":
          finalizar(evento.v);
          break;
        case "fin":
          finalizar(null, evento);
          break;
      }
    });
    puerto.onDisconnect.addListener(() => finalizar(respuesta ? null : "Se perdió la conexión con EduIA."));
    puerto.postMessage(solicitud);
  }

  // ---------- Eventos ----------

  const ctxPaneles = {
    panel,
    api,
    toast: avisar,
    ajustes: () => estado.ajustes,
    guardarAjustes: async (parciales) => {
      estado.ajustes = { ...estado.ajustes, ...parciales };
      await chrome.storage.local.set({ ajustes: estado.ajustes });
    },
    alumno: () => ({ id: estado.alumno.id, nombre: nombreAlumno() }),
    alCambiarRecordatorios: (recordatorios) => pintarContador(recordatorios.filter((r) => r.estado === "pendiente").length),
    preguntar: (texto) => enviar(texto),
    prellenar: (texto) => {
      entrada.value = texto;
      autoAjustar();
      actualizarBotonEnviar();
      entrada.focus();
      entrada.setSelectionRange(texto.length, texto.length);
    },
  };

  const acciones = {
    minimizar: cerrar,
    expandir: () => alternarExpandido(),
    nuevo: nuevaConversacion,
    ajustes: () => globalThis.EduPaneles.ajustes(ctxPaneles),
    recordatorios: () => globalThis.EduPaneles.recordatorios(ctxPaneles),
    releer: () => {
      Ctx.olvidarDocumentos();
      prepararContexto({ forzar: true });
    },
    "explicar-seleccion": () => {
      const texto = textoSeleccionado;
      ocultarSeleccion();
      enviar("Explícame este fragmento de forma simple, con un ejemplo.", { seleccion: texto });
    },
    "preguntar-seleccion": () => {
      const texto = textoSeleccionado;
      ocultarSeleccion();
      abrir();
      ctxPaneles.prellenar(`Sobre «${texto.slice(0, 300)}»: `);
    },
  };

  raiz.addEventListener("click", (e) => {
    const accion = e.target.closest("[data-accion]")?.dataset.accion;
    if (accion && acciones[accion]) acciones[accion]();
    const copiar = e.target.closest(".edu-copiar");
    if (copiar) {
      navigator.clipboard.writeText(copiar.closest(".edu-codigo").querySelector("code").textContent);
      copiar.textContent = "¡Copiado!";
      setTimeout(() => (copiar.textContent = "Copiar"), 1500);
    }
  });

  // Evita que los atajos de teclado de Blackboard reaccionen mientras se escribe en EduIA.
  raiz.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && estado.abierto) {
      cerrar();
      burbuja.focus();
    }
    e.stopPropagation();
  });

  burbuja.addEventListener("click", () => (estado.abierto ? cerrar() : abrir()));
  saludo.addEventListener("click", (e) => {
    if (e.target.closest(".edu-saludo-cerrar")) {
      ocultarSaludo();
      return;
    }
    abrir();
  });
  panel.querySelector(".edu-cabecera").addEventListener("dblclick", (e) => {
    if (!e.target.closest("button")) alternarExpandido();
  });
  irAbajo.addEventListener("click", () => {
    mensajes.scrollTo({ top: mensajes.scrollHeight, behavior: "smooth" });
    irAbajo.hidden = true;
  });

  entrada.addEventListener("input", () => {
    autoAjustar();
    actualizarBotonEnviar();
  });
  entrada.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      enviar();
    }
  });
  botonEnviar.addEventListener("click", () => (estado.finalizarActual ? estado.finalizarActual("Detuviste la respuesta.") : enviar()));

  function pintarModo() {
    botonesModo.forEach((b) => b.setAttribute("aria-checked", String(b.dataset.modo === estado.modo)));
  }
  botonesModo.forEach((boton) =>
    boton.addEventListener("click", () => {
      estado.modo = boton.dataset.modo;
      pintarModo();
      chrome.storage.local.set({ modo: estado.modo });
      avisar(estado.modo === "rapido" ? "⚡ Modo rápido: respuestas al instante" : "🧠 Modo profundo: más detalle y lectura de diagramas");
    })
  );

  if (botonMicrofono) {
    let reconocimiento = null;
    botonMicrofono.addEventListener("click", () => {
      if (reconocimiento) {
        reconocimiento.stop();
        return;
      }
      const base = entrada.value ? `${entrada.value.trimEnd()} ` : "";
      reconocimiento = new Reconocimiento();
      reconocimiento.lang = "es-PE";
      reconocimiento.interimResults = true;
      reconocimiento.onresult = (e) => {
        entrada.value = base + [...e.results].map((r) => r[0].transcript).join("");
        autoAjustar();
        actualizarBotonEnviar();
      };
      reconocimiento.onend = () => {
        reconocimiento = null;
        botonMicrofono.classList.remove("edu-microfono--activo");
        entrada.focus();
      };
      reconocimiento.onerror = (e) => e.error === "not-allowed" && avisar("Permite el micrófono para dictar 🎤");
      botonMicrofono.classList.add("edu-microfono--activo");
      reconocimiento.start();
    });
  }

  // Botones flotantes al seleccionar texto en Blackboard.
  let textoSeleccionado = "";
  const ocultarSeleccion = () => (menuSeleccion.hidden = true);
  document.addEventListener("mouseup", (e) => {
    if (estado.ajustes.seleccion === false || e.composedPath().includes(host)) return;
    setTimeout(() => {
      const seleccion = document.getSelection();
      const texto = seleccion?.toString().trim() || "";
      if (texto.length < 3 || texto.length > 4000 || !seleccion.rangeCount) return ocultarSeleccion();
      const rect = seleccion.getRangeAt(0).getBoundingClientRect();
      if (!rect.width && !rect.height) return ocultarSeleccion();
      textoSeleccionado = texto;
      menuSeleccion.hidden = false;
      menuSeleccion.style.left = `${Math.min(Math.max(8, rect.left + rect.width / 2 - 115), innerWidth - 240)}px`;
      menuSeleccion.style.top = `${rect.top > 60 ? rect.top - 48 : rect.bottom + 8}px`;
    }, 10);
  });
  document.addEventListener("mousedown", (e) => !e.composedPath().includes(menuSeleccion) && ocultarSeleccion(), true);
  addEventListener("scroll", ocultarSeleccion, { passive: true, capture: true });

  // ---------- Inicio ----------

  async function iniciar() {
    const guardado = await chrome.storage.local.get(["ajustes", "conversacion", "modo", "idInstalacion"]);
    estado.ajustes = guardado.ajustes || {};
    estado.modo = guardado.modo || "rapido";
    const idInstalacion = guardado.idInstalacion || `inst-${crypto.randomUUID()}`;
    if (!guardado.idInstalacion) chrome.storage.local.set({ idInstalacion });

    const alumno = await conLimite(Ctx.alumno().catch(() => null), 1500);
    estado.alumno = { id: alumno?.id || idInstalacion, nombre: alumno?.nombre || "" };

    pintarModo();
    if (!restaurarConversacion(guardado.conversacion)) pintarBienvenida();
    document.body.append(host);
    refrescarContador();

    if (sessionStorage.getItem("eduia-abierto")) {
      if (sessionStorage.getItem("eduia-expandido")) alternarExpandido(true);
      abrir({ enfocar: false });
    } else {
      setTimeout(mostrarSaludo, 2500);
      if (debePrecargar()) setTimeout(() => prepararContexto(), 1500);
    }
  }

  iniciar();
})();
