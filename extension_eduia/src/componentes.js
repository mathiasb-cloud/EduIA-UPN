// EduIA-UPN · Piezas visuales reutilizables: íconos, quiz interactivo y tarjetas.
(() => {
  const TRAZOS = {
    birrete: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/><path d="M22 10v6"/>',
    abajo: '<path d="m6 9 6 6 6-6"/>',
    campana: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    nuevo: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    ajustes: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    expandir: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
    contraer: '<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>',
    minimizar: '<path d="M5 12h14"/>',
    enviar: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    detener: '<rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none"/>',
    microfono: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4"/>',
    atras: '<path d="m15 18-6-6 6-6"/>',
    recargar: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    documento: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
    libro: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
    candado: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    brujula: '<circle cx="12" cy="12" r="10"/><path d="m16.2 7.8-2.1 6.3-6.3 2.1 2.1-6.3z"/>',
  };

  function icono(nombre, tamano = 18) {
    return (
      `<svg width="${tamano}" height="${tamano}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
      `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TRAZOS[nombre] || ""}</svg>`
    );
  }

  function el(etiqueta, props = {}, ...hijos) {
    const nodo = document.createElement(etiqueta);
    for (const [clave, valor] of Object.entries(props)) {
      if (valor == null || valor === false) continue;
      if (clave === "class") nodo.className = valor;
      else if (clave === "html") nodo.innerHTML = valor;
      else if (clave === "style") nodo.style.cssText = valor;
      else if (clave.startsWith("on")) nodo.addEventListener(clave.slice(2), valor);
      else nodo.setAttribute(clave, valor === true ? "" : valor);
    }
    for (const hijo of hijos.flat()) {
      if (hijo != null && hijo !== false) nodo.append(hijo instanceof Node ? hijo : String(hijo));
    }
    return nodo;
  }

  const EMOJI_TIPO = { examen: "📝", tarea: "📚", clase: "🎥", blackboard: "💻", estudio: "🧠", otro: "⏰" };

  function quiz(jsonTexto, { alTerminar, alCambiar } = {}) {
    let datos = null;
    try {
      datos = JSON.parse(jsonTexto);
    } catch {
      // se muestra el aviso de abajo
    }
    const preguntas = (datos?.preguntas || []).filter((p) => p?.pregunta && Array.isArray(p.opciones) && p.opciones.length >= 2);
    if (!preguntas.length) return el("div", { class: "edu-quiz-cargando" }, "No pude armar el quiz. Pídemelo de nuevo 🙏");

    const raiz = el("div", { class: "edu-quiz" });
    let indice = 0;
    let aciertos = 0;
    const fallos = [];

    const barra = (avance) => el("div", { class: "edu-quiz-barra" }, el("span", { style: `width:${avance * 100}%` }));

    function mostrar() {
      const pregunta = preguntas[indice];
      const opciones = el("div", { class: "edu-quiz-opciones" });
      const explicacion = el("div", { class: "edu-quiz-explicacion", hidden: true });
      const pie = el("div", { class: "edu-quiz-pie", hidden: true });

      pregunta.opciones.forEach((texto, i) => {
        opciones.append(
          el(
            "button",
            { class: "edu-opcion", type: "button", style: `--i:${i}`, onclick: () => responder(i) },
            el("span", { class: "edu-opcion-letra" }, "ABCDEF"[i] || i + 1),
            el("span", {}, texto)
          )
        );
      });

      raiz.replaceChildren(
        el("div", { class: "edu-quiz-cabecera" }, el("strong", {}, datos.titulo || "Quiz"), el("span", { class: "edu-quiz-progreso" }, `${indice + 1}/${preguntas.length}`)),
        barra(indice / preguntas.length),
        el("div", { class: "edu-quiz-pregunta" }, pregunta.pregunta),
        opciones,
        explicacion,
        pie
      );

      function responder(elegida) {
        const correcta = Number(pregunta.correcta);
        const botones = [...opciones.children];
        botones.forEach((b) => (b.disabled = true));
        botones[correcta]?.classList.add("edu-opcion--correcta");
        if (elegida === correcta) {
          aciertos++;
        } else {
          botones[elegida].classList.add("edu-opcion--incorrecta");
          fallos.push(pregunta.pregunta);
        }
        explicacion.textContent = `${elegida === correcta ? "✅ ¡Correcto! " : "💡 "}${pregunta.explicacion || ""}`;
        explicacion.hidden = false;
        raiz.querySelector(".edu-quiz-barra span").style.width = `${((indice + 1) / preguntas.length) * 100}%`;
        const ultima = indice === preguntas.length - 1;
        pie.replaceChildren(
          el(
            "button",
            { class: "edu-boton edu-boton-primario edu-boton-mini", type: "button", onclick: () => (ultima ? resultado() : (indice++, mostrar())) },
            ultima ? "Ver resultado" : "Siguiente →"
          )
        );
        pie.hidden = false;
        alCambiar?.();
      }
      alCambiar?.();
    }

    function resultado() {
      const total = preguntas.length;
      const nota = Math.round((aciertos / total) * 20);
      const mensaje =
        aciertos === total ? "¡Perfecto! Dominas el tema 🎉" : aciertos / total >= 0.6 ? "¡Bien! Vas por buen camino 💪" : "Repasemos juntos lo que falló 📚";
      raiz.replaceChildren(
        el(
          "div",
          { class: "edu-quiz-resultado" },
          el("div", { class: "edu-quiz-puntaje" }, `${aciertos}/${total}`),
          el("p", {}, `${mensaje} · Nota referencial: ${nota}/20`),
          el(
            "div",
            { class: "edu-fila", style: "justify-content:center" },
            fallos.length
              ? el("button", { class: "edu-boton edu-boton-primario edu-boton-mini", type: "button", onclick: () => alTerminar?.({ repasar: [...fallos] }) }, "Explícame lo que fallé")
              : null,
            el(
              "button",
              {
                class: "edu-boton edu-boton-secundario edu-boton-mini",
                type: "button",
                onclick: () => {
                  indice = 0;
                  aciertos = 0;
                  fallos.length = 0;
                  mostrar();
                },
              },
              "Intentar de nuevo"
            )
          )
        )
      );
      alCambiar?.();
    }

    mostrar();
    return raiz;
  }

  function tarjetaRecordatorio(rec, { alCancelar }) {
    const tarjeta = el(
      "div",
      { class: "edu-recordatorio", "data-estado": rec.aviso ? "aviso" : "pendiente" },
      el("div", { class: "edu-rec-icono" }, EMOJI_TIPO[rec.tipo] || "⏰"),
      el(
        "div",
        { class: "edu-rec-info" },
        el("strong", {}, "Recordatorio programado"),
        el("span", {}, rec.mensaje),
        el("small", {}, `🗓️ ${rec.enviar_en_legible} · WhatsApp ${rec.telefono}`),
        rec.aviso ? el("em", {}, `⚠️ ${rec.aviso}`) : null
      )
    );
    const boton = el(
      "button",
      {
        class: "edu-boton edu-boton-secundario edu-boton-mini",
        type: "button",
        onclick: async () => {
          boton.disabled = true;
          if (await alCancelar(rec)) {
            tarjeta.dataset.estado = "cancelado";
            boton.textContent = "Cancelado";
          } else {
            boton.disabled = false;
          }
        },
      },
      "Cancelar"
    );
    tarjeta.append(boton);
    return tarjeta;
  }

  function toast(contenedor, texto) {
    contenedor.querySelector(".edu-toast")?.remove();
    const aviso = el("div", { class: "edu-toast", role: "status" }, texto);
    contenedor.append(aviso);
    setTimeout(() => aviso.remove(), 3300);
  }

  globalThis.EduUI = { icono, el, quiz, tarjetaRecordatorio, toast, EMOJI_TIPO };
})();
