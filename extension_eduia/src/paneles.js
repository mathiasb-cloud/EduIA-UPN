// EduIA-UPN · Vistas secundarias del panel: Ajustes y Recordatorios.
(() => {
  const { el, icono, EMOJI_TIPO } = globalThis.EduUI;
  const ESTADOS = { pendiente: "Pendiente", enviando: "Enviando", enviado: "Enviado", error: "No enviado" };

  function abrirVista(ctx, titulo, construir) {
    ctx.panel.querySelectorAll(".edu-vista").forEach(cerrar);
    const cuerpo = el("div", { class: "edu-vista-cuerpo" });
    const vista = el(
      "div",
      { class: "edu-vista", role: "region", "aria-label": titulo },
      el(
        "header",
        { class: "edu-vista-cabecera" },
        el("button", { class: "edu-boton-icono", type: "button", title: "Volver", "aria-label": "Volver", html: icono("atras", 20), onclick: () => cerrar(vista) }),
        el("h2", {}, titulo)
      ),
      cuerpo
    );
    vista.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        cerrar(vista);
      }
    });
    ctx.panel.append(vista);
    construir(cuerpo, () => cerrar(vista));
    vista.querySelector("button").focus();
  }

  function cerrar(vista) {
    if (vista.classList.contains("edu-vista--saliendo")) return;
    vista.classList.add("edu-vista--saliendo");
    vista.addEventListener("animationend", () => vista.remove(), { once: true });
  }

  const seccion = (titulo, ...hijos) => el("section", { class: "edu-seccion" }, el("h3", { class: "edu-seccion-titulo" }, titulo), ...hijos);

  function interruptor(texto, marcado) {
    const casilla = el("input", { type: "checkbox" });
    casilla.checked = marcado;
    return { nodo: el("label", { class: "edu-interruptor" }, el("span", {}, texto), casilla), casilla };
  }

  // ---------- Ajustes ----------

  function ajustes(ctx) {
    abrirVista(ctx, "Ajustes", (cuerpo, volver) => {
      const actuales = ctx.ajustes();
      const alumno = ctx.alumno();
      const whatsapp = (actuales.whatsapp || "").replace(/^\+51/, "");

      const nombre = el("input", { class: "edu-input", id: "edu-nombre", value: actuales.nombre || alumno.nombre || "", maxlength: 40, placeholder: "¿Cómo te llamo?" });
      const telefono = el("input", { class: "edu-input", id: "edu-whatsapp", value: whatsapp, inputmode: "tel", placeholder: "9XX XXX XXX", maxlength: 20 });
      const saludo = interruptor("Saludarme al entrar a Blackboard", actuales.saludo !== false);
      const leerDocs = interruptor("Leer los archivos que abro (PDF, Word, PPT)", actuales.leerDocumentos !== false);
      const seleccion = interruptor("Mostrar «Explícame» al seleccionar texto", actuales.seleccion !== false);
      const servidor = el("input", { class: "edu-input", id: "edu-servidor", value: actuales.servidor || "http://localhost:8000", placeholder: "http://localhost:8000" });

      const numeroCompleto = () => {
        const digitos = telefono.value.replace(/[^\d+]/g, "");
        if (!digitos) return "";
        return digitos.startsWith("+") ? digitos : /^9\d{8}$/.test(digitos) ? `+51${digitos}` : `+${digitos}`;
      };

      const botonPrueba = el("button", { class: "edu-boton edu-boton-secundario edu-boton-mini", type: "button" }, "📲 Enviar mensaje de prueba");
      botonPrueba.addEventListener("click", async () => {
        botonPrueba.disabled = true;
        const r = await ctx.api("POST", "/whatsapp/prueba", { whatsapp: numeroCompleto(), nombre: nombre.value.trim() });
        botonPrueba.disabled = false;
        ctx.toast(r.ok ? `✅ Mensaje enviado a ${r.datos.telefono}` : `⚠️ ${r.datos?.detail || "No se pudo enviar."}`);
      });

      const botonServidor = el("button", { class: "edu-boton edu-boton-secundario edu-boton-mini", type: "button" }, "Probar conexión");
      botonServidor.addEventListener("click", async () => {
        await ctx.guardarAjustes({ servidor: servidor.value.trim() });
        const r = await ctx.api("GET", "/salud");
        ctx.toast(r.ok ? "✅ Servidor de EduIA conectado" : "⚠️ No hay conexión con el servidor");
      });

      const guardar = el("button", { class: "edu-boton edu-boton-primario", type: "button", style: "width:100%" }, "Guardar cambios");
      guardar.addEventListener("click", async () => {
        await ctx.guardarAjustes({
          nombre: nombre.value.trim(),
          whatsapp: numeroCompleto(),
          saludo: saludo.casilla.checked,
          leerDocumentos: leerDocs.casilla.checked,
          seleccion: seleccion.casilla.checked,
          servidor: servidor.value.trim(),
        });
        ctx.toast("Ajustes guardados ✓");
        volver();
      });

      cuerpo.append(
        seccion("Tu perfil", el("div", { class: "edu-campo" }, el("label", { for: "edu-nombre" }, "Nombre"), nombre)),
        seccion(
          "Recordatorios por WhatsApp",
          el(
            "div",
            { class: "edu-campo" },
            el("label", { for: "edu-whatsapp" }, "Tu número de WhatsApp"),
            el("div", { class: "edu-telefono" }, el("span", { class: "edu-prefijo" }, "🇵🇪 +51"), telefono),
            el("p", { class: "edu-nota" }, "Te escribiremos solo para los recordatorios que tú pidas.")
          ),
          botonPrueba
        ),
        seccion("Preferencias", saludo.nodo, leerDocs.nodo, seleccion.nodo),
        seccion(
          "Avanzado",
          el("div", { class: "edu-campo" }, el("label", { for: "edu-servidor" }, "Servidor de EduIA"), servidor),
          botonServidor
        ),
        guardar
      );
    });
  }

  // ---------- Recordatorios ----------

  function recordatorios(ctx) {
    abrirVista(ctx, "Recordatorios", (cuerpo, volver) => {
      const lista = el("div", {}, el("div", { class: "edu-esqueleto" }), el("div", { class: "edu-esqueleto" }));
      const entregas = el("div", {}, el("div", { class: "edu-esqueleto" }), el("div", { class: "edu-esqueleto" }));
      const actualizar = el("button", { class: "edu-boton-icono", type: "button", title: "Actualizar", "aria-label": "Actualizar", html: icono("recargar", 16), style: "width:26px;height:26px" });

      cuerpo.append(
        el(
          "section",
          { class: "edu-seccion" },
          el("h3", { class: "edu-seccion-titulo" }, el("span", {}, "Tus recordatorios"), actualizar),
          lista
        ),
        seccion("Próximas fechas en Blackboard", entregas),
        seccion(
          "Crear uno nuevo",
          el("p", { class: "edu-nota", style: "margin-bottom:10px" }, "Pídelo en el chat con tus palabras, por ejemplo: «recuérdame el viernes a las 8 pm entregar el T2»."),
          el(
            "button",
            {
              class: "edu-boton edu-boton-secundario edu-boton-mini",
              type: "button",
              onclick: () => {
                volver();
                ctx.prellenar("Recuérdame ");
              },
            },
            "✍️ Escribir recordatorio"
          )
        )
      );

      async function cargarLista() {
        const r = await ctx.api("GET", `/recordatorios?alumno=${encodeURIComponent(ctx.alumno().id)}`);
        if (!r.ok) {
          lista.replaceChildren(el("div", { class: "edu-vacio" }, "No pude cargar tus recordatorios. ¿El servidor de EduIA está encendido?"));
          return;
        }
        ctx.alCambiarRecordatorios(r.datos);
        if (!r.datos.length) {
          lista.replaceChildren(el("div", { class: "edu-vacio" }, "🔔 Aún no tienes recordatorios. ¡Programa el primero!"));
          return;
        }
        lista.replaceChildren(
          ...r.datos.map((rec, i) => {
            const cancelar =
              rec.estado === "pendiente"
                ? el("button", { class: "edu-boton edu-boton-secundario edu-boton-mini", type: "button" }, "Cancelar")
                : null;
            cancelar?.addEventListener("click", async () => {
              cancelar.disabled = true;
              const res = await ctx.api("DELETE", `/recordatorios/${rec.id}?alumno=${encodeURIComponent(ctx.alumno().id)}`);
              ctx.toast(res.ok ? "Recordatorio cancelado" : "No se pudo cancelar");
              cargarLista();
            });
            return el(
              "div",
              { class: "edu-item", style: `--i:${i}` },
              el("div", { class: "edu-item-icono" }, EMOJI_TIPO[rec.tipo] || "⏰"),
              el(
                "div",
                { class: "edu-item-info" },
                el("strong", { title: rec.mensaje }, rec.mensaje),
                el("small", {}, `${rec.enviar_en_legible} · `, el("span", { class: `edu-etiqueta edu-etiqueta--${rec.estado}` }, ESTADOS[rec.estado] || rec.estado)),
                rec.error ? el("em", {}, rec.error) : null
              ),
              cancelar
            );
          })
        );
      }

      async function cargarEntregas() {
        const items = await globalThis.EduContexto.proximasEntregas().catch(() => null);
        if (!items) {
          entregas.replaceChildren(el("div", { class: "edu-vacio" }, "No pude leer tu calendario desde aquí. Revísalo en Calendario, en el menú de Blackboard."));
          return;
        }
        if (!items.length) {
          entregas.replaceChildren(el("div", { class: "edu-vacio" }, "🎉 No tienes entregas en las próximas 3 semanas."));
          return;
        }
        entregas.replaceChildren(
          ...items.slice(0, 12).map((item, i) => {
            const avisar = el("button", { class: "edu-boton edu-boton-secundario edu-boton-mini", type: "button" }, "⏰ Avisarme");
            avisar.addEventListener("click", async () => {
              avisar.disabled = true;
              const vence = new Date(item.fechaIso).getTime();
              const envio = [vence - 24 * 36e5, vence - 3 * 36e5, Date.now() + 6e4].find((t) => t > Date.now() + 3e4);
              const r = await ctx.api("POST", "/recordatorios", {
                alumno: ctx.alumno().id,
                whatsapp: ctx.ajustes().whatsapp || "",
                mensaje: `«${item.titulo}»${item.curso ? ` de ${item.curso}` : ""} vence el ${item.fecha} · ¡Tú puedes!`,
                tipo: "tarea",
                fecha_hora: new Date(envio).toISOString(),
              });
              if (r.ok) {
                avisar.textContent = "✓ Programado";
                ctx.toast(`🔔 Te avisaré el ${r.datos.enviar_en_legible}`);
                cargarLista();
              } else {
                avisar.disabled = false;
                ctx.toast(`⚠️ ${r.datos?.detail || "No se pudo programar"}`);
              }
            });
            return el(
              "div",
              { class: "edu-item", style: `--i:${i}` },
              el("div", { class: "edu-item-icono" }, "📌"),
              el("div", { class: "edu-item-info" }, el("strong", { title: item.titulo }, item.titulo), el("small", {}, [item.fecha, item.curso].filter(Boolean).join(" · "))),
              avisar
            );
          }),
          el(
            "button",
            {
              class: "edu-boton edu-boton-primario edu-boton-mini",
              type: "button",
              style: "margin-top:12px",
              onclick: () => {
                volver();
                ctx.preguntar("Ayúdame a organizar mi semana según mis próximas entregas");
              },
            },
            "🗓️ Planifica mi semana con EduIA"
          )
        );
      }

      actualizar.addEventListener("click", cargarLista);
      cargarLista();
      cargarEntregas();
    });
  }

  globalThis.EduPaneles = { ajustes, recordatorios };
})();
