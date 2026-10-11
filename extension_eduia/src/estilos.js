// EduIA-UPN · Estilos del widget (se inyectan dentro de un Shadow DOM para no chocar con Blackboard).
globalThis.EDU_ESTILOS = `
:host { all: initial; }

.edu {
  --naranja: #ff5e14;
  --naranja-2: #ff8a3d;
  --naranja-oscuro: #d9480f;
  --naranja-suave: #fff1e8;
  --tinta: #1b1d23;
  --tinta-2: #3d4150;
  --tenue: #6b7080;
  --borde: #ebebf0;
  --fondo: #f6f6f9;
  --blanco: #ffffff;
  --verde: #16a34a;
  --rojo: #dc2626;
  --ambar: #b45309;
  --sombra-panel: 0 24px 60px -12px rgba(17, 18, 23, .28), 0 8px 24px -8px rgba(17, 18, 23, .16), 0 0 0 1px rgba(17, 18, 23, .06);
  --curva-resorte: cubic-bezier(.34, 1.56, .64, 1);
  --curva-suave: cubic-bezier(.22, 1, .36, 1);
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: var(--tinta);
  -webkit-font-smoothing: antialiased;
}
.edu *, .edu *::before, .edu *::after { box-sizing: border-box; }
:where(.edu) button { font: inherit; color: inherit; cursor: pointer; border: 0; background: none; padding: 0; }
.edu [hidden] { display: none !important; }
.edu svg { display: block; }
.edu :focus-visible { outline: 2px solid var(--naranja); outline-offset: 2px; }

/* ---------- Burbuja flotante ---------- */
.edu-burbuja {
  position: fixed; right: 24px; bottom: 24px; z-index: 2147483000;
  width: 60px; height: 60px; border-radius: 50%;
  display: grid; place-items: center;
  background: linear-gradient(145deg, var(--naranja-2), var(--naranja) 55%, var(--naranja-oscuro));
  color: #fff;
  box-shadow: 0 10px 28px -6px rgba(255, 94, 20, .6), 0 3px 8px rgba(0, 0, 0, .18), inset 0 1px 0 rgba(255, 255, 255, .35);
  animation: edu-burbuja-entrada .7s var(--curva-resorte) .25s both;
  transition: transform .35s var(--curva-resorte), box-shadow .3s ease, opacity .25s ease;
}
.edu-burbuja:hover { transform: translateY(-3px) scale(1.06); box-shadow: 0 16px 36px -8px rgba(255, 94, 20, .7), 0 4px 10px rgba(0, 0, 0, .2), inset 0 1px 0 rgba(255, 255, 255, .35); }
.edu-burbuja:active { transform: scale(.92); transition-duration: .12s; }
.edu-burbuja-halo { position: absolute; inset: 0; border-radius: 50%; pointer-events: none; }
.edu-burbuja--atencion .edu-burbuja-halo::before,
.edu-burbuja--atencion .edu-burbuja-halo::after {
  content: ""; position: absolute; inset: 0; border-radius: 50%;
  border: 2px solid var(--naranja); opacity: 0;
  animation: edu-halo 2.8s ease-out infinite;
}
.edu-burbuja--atencion .edu-burbuja-halo::after { animation-delay: 1.4s; }
.edu-burbuja-icono { position: absolute; transition: transform .45s var(--curva-resorte), opacity .25s ease; }
.edu-icono-cerrar { opacity: 0; transform: rotate(-90deg) scale(.4); }
.edu-burbuja[aria-expanded="true"] .edu-icono-abrir { opacity: 0; transform: rotate(90deg) scale(.4); }
.edu-burbuja[aria-expanded="true"] .edu-icono-cerrar { opacity: 1; transform: none; }
.edu-burbuja--oculta { transform: scale(0) !important; opacity: 0; pointer-events: none; }
.edu-burbuja-punto {
  position: absolute; top: 2px; right: 2px; width: 14px; height: 14px; border-radius: 50%;
  background: #22c55e; border: 2.5px solid #fff; animation: edu-pop .45s var(--curva-resorte);
}

/* ---------- Saludo junto a la burbuja ---------- */
.edu-saludo {
  position: fixed; right: 96px; bottom: 34px; z-index: 2147483000;
  max-width: 260px; padding: 12px 34px 12px 14px;
  background: var(--blanco); color: var(--tinta); border-radius: 16px 16px 4px 16px;
  box-shadow: 0 12px 32px -8px rgba(17, 18, 23, .25), 0 0 0 1px rgba(17, 18, 23, .06);
  font-size: 13.5px; line-height: 1.4; cursor: pointer;
  transform-origin: bottom right;
  animation: edu-saludo-entrada .55s var(--curva-resorte) both;
}
.edu-saludo--saliendo { animation: edu-saludo-salida .25s ease-in both; }
.edu-saludo strong { display: block; margin-bottom: 2px; font-size: 14px; }
.edu-saludo-cerrar {
  position: absolute; top: 6px; right: 6px; width: 22px; height: 22px; border-radius: 50%;
  display: grid; place-items: center; color: var(--tenue); font-size: 16px; line-height: 1;
}
.edu-saludo-cerrar:hover { background: var(--fondo); color: var(--tinta); }

/* ---------- Panel ---------- */
.edu-panel {
  position: fixed; right: 24px; bottom: 100px; z-index: 2147483001;
  width: 400px; height: min(680px, calc(100vh - 124px));
  display: flex; flex-direction: column; overflow: hidden;
  background: var(--blanco); border-radius: 22px; box-shadow: var(--sombra-panel);
  transform-origin: bottom right;
  transition: width .45s var(--curva-suave), height .45s var(--curva-suave), bottom .45s var(--curva-suave), right .45s var(--curva-suave), border-radius .45s var(--curva-suave);
}
.edu-panel--expandida { width: min(980px, calc(100vw - 48px)); height: calc(100vh - 48px); bottom: 24px; }
.edu-panel--entrando .edu-cabecera,
.edu-panel--entrando .edu-contexto,
.edu-panel--entrando .edu-cuerpo,
.edu-panel--entrando .edu-compositor { animation: edu-subir .55s var(--curva-suave) both; }
.edu-panel--entrando .edu-contexto { animation-delay: .05s; }
.edu-panel--entrando .edu-cuerpo { animation-delay: .1s; }
.edu-panel--entrando .edu-compositor { animation-delay: .15s; }

/* Cabecera */
.edu-cabecera {
  position: relative; display: flex; align-items: center; gap: 12px; padding: 14px 12px 14px 16px;
  background: radial-gradient(120% 140% at 0% 0%, rgba(255, 94, 20, .35), transparent 55%), linear-gradient(135deg, #1d1f26, #121317);
  color: #fff; user-select: none;
}
.edu-avatar {
  position: relative; flex: none; width: 40px; height: 40px; border-radius: 13px; display: grid; place-items: center;
  background: linear-gradient(145deg, var(--naranja-2), var(--naranja-oscuro)); box-shadow: 0 6px 16px -4px rgba(255, 94, 20, .6);
}
.edu-en-linea { position: absolute; right: -2px; bottom: -2px; width: 12px; height: 12px; border-radius: 50%; background: #22c55e; border: 2px solid #17181d; }
.edu-cabecera-textos { flex: 1; min-width: 0; }
.edu-titulo { display: flex; align-items: center; gap: 6px; font-size: 15.5px; font-weight: 700; letter-spacing: -.01em; }
.edu-insignia { padding: 1px 6px; border-radius: 6px; background: rgba(255, 255, 255, .14); font-size: 10.5px; font-weight: 700; letter-spacing: .06em; }
.edu-estado { font-size: 12px; color: rgba(255, 255, 255, .68); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.edu-acciones { display: flex; gap: 2px; }
.edu-boton-icono {
  position: relative; width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center;
  color: inherit; opacity: .82; transition: background .2s ease, opacity .2s ease, transform .2s var(--curva-resorte);
}
.edu-boton-icono:hover { opacity: 1; background: rgba(255, 255, 255, .12); }
.edu-boton-icono:active { transform: scale(.9); }
.edu-contador {
  position: absolute; top: 3px; right: 3px; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px;
  background: var(--naranja); color: #fff; font-size: 10px; font-weight: 700; line-height: 16px; text-align: center;
}

/* Barra de contexto */
.edu-contexto {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px 8px 16px;
  background: var(--naranja-suave); color: #9a3412; font-size: 12.5px; border-bottom: 1px solid #ffe2cf;
}
.edu-contexto[data-estado="aviso"] { background: #fef3c7; color: var(--ambar); border-color: #fde68a; }
.edu-contexto[data-estado="error"] { background: #f4f4f6; color: var(--tenue); border-color: var(--borde); }
.edu-contexto-icono { flex: none; width: 16px; height: 16px; display: grid; place-items: center; }
.edu-contexto[data-estado="leyendo"] .edu-contexto-icono::before { content: ""; width: 12px; height: 12px; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent; animation: edu-girar .8s linear infinite; }
.edu-contexto-texto { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.edu-contexto-recargar { flex: none; width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; opacity: .75; transition: background .2s, transform .4s var(--curva-suave); }
.edu-contexto-recargar:hover { opacity: 1; background: rgba(0, 0, 0, .06); transform: rotate(180deg); }

/* Mensajes */
.edu-cuerpo { position: relative; flex: 1; min-height: 0; background: var(--fondo); }
.edu-mensajes { height: 100%; overflow-y: auto; overscroll-behavior: contain; scroll-behavior: smooth; padding: 18px 16px 8px; }
.edu-mensajes::-webkit-scrollbar { width: 8px; }
.edu-mensajes::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, .12); border-radius: 8px; border: 2px solid var(--fondo); }
.edu-lista { display: flex; flex-direction: column; gap: 16px; margin: 0 auto; max-width: 780px; }
.edu-ir-abajo {
  position: absolute; left: 50%; bottom: 10px; transform: translateX(-50%);
  padding: 6px 12px; border-radius: 999px; background: var(--tinta); color: #fff !important; font-size: 12px; font-weight: 600;
  box-shadow: 0 6px 16px rgba(0, 0, 0, .2); animation: edu-pop .35s var(--curva-resorte);
}

.edu-msj { display: flex; gap: 10px; animation: edu-entrar .42s var(--curva-suave) both; }
.edu-msj-usuario { justify-content: flex-end; }
.edu-burbuja-usuario {
  max-width: 82%; padding: 10px 14px; border-radius: 18px 18px 4px 18px; white-space: pre-wrap; word-wrap: break-word;
  background: linear-gradient(135deg, var(--naranja-2), var(--naranja)); color: #fff; box-shadow: 0 4px 14px -6px rgba(255, 94, 20, .55);
}
.edu-burbuja-usuario .edu-cita { display: block; margin-bottom: 6px; padding-left: 8px; border-left: 2px solid rgba(255, 255, 255, .6); font-size: 12.5px; opacity: .9; }
.edu-msj-avatar {
  flex: none; width: 28px; height: 28px; border-radius: 9px; display: grid; place-items: center; margin-top: 2px;
  background: linear-gradient(145deg, var(--naranja-2), var(--naranja-oscuro)); color: #fff;
}
.edu-msj-contenido { flex: 1; min-width: 0; }
.edu-msj-bot .edu-md {
  padding: 12px 14px; border-radius: 4px 18px 18px 18px; background: var(--blanco);
  box-shadow: 0 1px 2px rgba(17, 18, 23, .05), 0 0 0 1px rgba(17, 18, 23, .04);
}
.edu-msj-error .edu-md { background: #fef2f2; color: #991b1b; box-shadow: 0 0 0 1px #fecaca; }
.edu-msj-acciones { display: flex; align-items: center; gap: 2px; margin-top: 4px; opacity: 0; transition: opacity .2s ease; }
.edu-msj:hover .edu-msj-acciones, .edu-msj-acciones:focus-within { opacity: 1; }
.edu-msj-acciones button { padding: 3px 8px; border-radius: 8px; font-size: 12px; color: var(--tenue); transition: background .15s, color .15s; }
.edu-msj-acciones button:hover { background: rgba(0, 0, 0, .05); color: var(--tinta); }
.edu-msj-acciones button[aria-pressed="true"] { color: var(--naranja); }
.edu-msj-meta { margin-left: auto; font-size: 11px; color: #a0a4b0; }

.edu-sugerencias { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.edu-chip {
  padding: 6px 12px; border-radius: 999px; background: var(--blanco); color: var(--tinta-2) !important; font-size: 12.5px; font-weight: 500;
  box-shadow: 0 0 0 1px var(--borde); animation: edu-entrar .4s var(--curva-suave) both; animation-delay: calc(var(--i, 0) * 70ms);
  transition: box-shadow .2s, color .2s, transform .25s var(--curva-resorte), background .2s;
}
.edu-chip:hover { box-shadow: 0 0 0 1.5px var(--naranja); color: var(--naranja-oscuro) !important; background: var(--naranja-suave); transform: translateY(-1px); }

.edu-escribiendo { display: inline-flex; gap: 4px; padding: 14px 16px; border-radius: 4px 18px 18px 18px; background: var(--blanco); box-shadow: 0 0 0 1px rgba(17, 18, 23, .04); }
.edu-escribiendo span { width: 7px; height: 7px; border-radius: 50%; background: var(--naranja); animation: edu-rebote 1.2s ease-in-out infinite; }
.edu-escribiendo span:nth-child(2) { animation-delay: .15s; }
.edu-escribiendo span:nth-child(3) { animation-delay: .3s; }

/* Markdown */
.edu-md { word-wrap: break-word; overflow-wrap: anywhere; }
.edu-md > :first-child { margin-top: 0; }
.edu-md > :last-child { margin-bottom: 0; }
.edu-md p { margin: 0 0 .65em; }
.edu-md h3, .edu-md h4, .edu-md h5, .edu-md h6 { margin: .9em 0 .4em; line-height: 1.3; font-weight: 700; }
.edu-md h3 { font-size: 16px; } .edu-md h4 { font-size: 15px; } .edu-md h5, .edu-md h6 { font-size: 14px; }
.edu-md ul, .edu-md ol { margin: 0 0 .65em; padding-left: 1.3em; }
.edu-md li { margin: .2em 0; }
.edu-md li::marker { color: var(--naranja); font-weight: 700; }
.edu-md strong { font-weight: 650; color: #0f1115; }
.edu-md a { color: var(--naranja-oscuro); text-decoration: underline; text-underline-offset: 2px; }
.edu-md code { padding: 1px 5px; border-radius: 5px; background: var(--naranja-suave); color: #c2410c; font: 12.5px/1.4 ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
.edu-md blockquote { margin: 0 0 .65em; padding: 6px 12px; border-left: 3px solid var(--naranja); background: #fafafc; border-radius: 0 8px 8px 0; color: var(--tinta-2); }
.edu-md hr { border: 0; height: 1px; background: var(--borde); margin: .9em 0; }
.edu-codigo { margin: 0 0 .65em; border-radius: 12px; overflow: hidden; background: #16171d; }
.edu-codigo-barra { display: flex; justify-content: space-between; align-items: center; padding: 6px 8px 6px 12px; background: #202129; color: #a4a8b8; font-size: 11.5px; }
.edu-copiar { padding: 2px 8px; border-radius: 6px; color: #d4d7e2 !important; font-size: 11.5px; }
.edu-copiar:hover { background: rgba(255, 255, 255, .1); }
.edu-codigo pre { margin: 0; padding: 12px; overflow-x: auto; }
.edu-codigo code { padding: 0; background: none; color: #e8e9f0; font-size: 12.5px; white-space: pre; }
.edu-tabla { margin: 0 0 .65em; overflow-x: auto; }
.edu-tabla table { border-collapse: collapse; font-size: 13px; width: 100%; }
.edu-tabla th, .edu-tabla td { padding: 6px 10px; border-bottom: 1px solid var(--borde); text-align: left; }
.edu-tabla th { background: #fafafc; font-weight: 650; }
.edu-md--streaming > :last-child::after {
  content: ""; display: inline-block; width: 7px; height: 15px; margin-left: 3px; vertical-align: -2px;
  border-radius: 2px; background: var(--naranja); animation: edu-parpadeo 1s steps(2, start) infinite;
}

/* Bienvenida */
.edu-bienvenida { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 10px 4px 4px; animation: edu-entrar .5s var(--curva-suave) both; }
.edu-bienvenida-avatar {
  position: relative; width: 64px; height: 64px; border-radius: 20px; display: grid; place-items: center; color: #fff;
  background: linear-gradient(145deg, var(--naranja-2), var(--naranja-oscuro)); box-shadow: 0 14px 30px -10px rgba(255, 94, 20, .7);
  animation: edu-flotar 4s ease-in-out infinite;
}
.edu-mano { position: absolute; right: -10px; top: -8px; font-size: 24px; transform-origin: 70% 80%; animation: edu-saludar 2.2s ease-in-out .6s 2; }
.edu-bienvenida h2 { margin: 14px 0 4px; font-size: 19px; font-weight: 750; letter-spacing: -.02em; }
.edu-bienvenida p { margin: 0 0 16px; max-width: 320px; color: var(--tenue); font-size: 13.5px; }
.edu-tarjetas { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%; }
.edu-panel--expandida .edu-tarjetas { grid-template-columns: repeat(4, 1fr); }
.edu-tarjeta {
  display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 12px; text-align: left;
  border-radius: 14px; background: var(--blanco); box-shadow: 0 0 0 1px var(--borde);
  animation: edu-entrar .45s var(--curva-suave) both; animation-delay: calc(.15s + var(--i, 0) * 60ms);
  transition: box-shadow .2s ease, transform .3s var(--curva-resorte);
}
.edu-tarjeta:hover { transform: translateY(-2px); box-shadow: 0 0 0 1.5px var(--naranja), 0 10px 20px -12px rgba(255, 94, 20, .5); }
.edu-tarjeta-emoji { font-size: 20px; line-height: 1; }
.edu-tarjeta strong { display: block; font-size: 13px; font-weight: 650; line-height: 1.3; }
.edu-tarjeta small { display: block; color: var(--tenue); font-size: 11.5px; line-height: 1.3; }
.edu-enlace-cachimbo { margin-top: 12px; color: var(--naranja-oscuro) !important; font-size: 12.5px; font-weight: 600; }
.edu-enlace-cachimbo:hover { text-decoration: underline; }

/* Tarjeta de recordatorio */
.edu-recordatorio {
  display: flex; align-items: center; gap: 12px; margin-top: 8px; padding: 12px; border-radius: 14px;
  background: linear-gradient(135deg, #f0fdf4, #ecfeff); box-shadow: 0 0 0 1px #bbf7d0; animation: edu-pop .5s var(--curva-resorte) both;
}
.edu-recordatorio[data-estado="cancelado"] { background: #f4f4f6; box-shadow: 0 0 0 1px var(--borde); opacity: .75; }
.edu-recordatorio[data-estado="aviso"] { background: #fffbeb; box-shadow: 0 0 0 1px #fde68a; }
.edu-rec-icono { flex: none; width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; font-size: 20px; background: #fff; box-shadow: 0 2px 6px rgba(0, 0, 0, .06); }
.edu-rec-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.edu-rec-info strong { font-size: 13px; }
.edu-rec-info span { font-size: 13px; color: var(--tinta-2); }
.edu-rec-info small { font-size: 11.5px; color: var(--tenue); }
.edu-rec-info em { font-style: normal; font-size: 11.5px; color: var(--ambar); }

/* Quiz */
.edu-quiz { margin: 4px 0 .65em; padding: 14px; border-radius: 14px; background: #fafafc; box-shadow: 0 0 0 1px var(--borde); }
.edu-quiz-cargando { display: flex; align-items: center; gap: 8px; padding: 12px; border-radius: 12px; background: #fafafc; color: var(--tenue); }
.edu-quiz-cabecera { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 13px; }
.edu-quiz-progreso { color: var(--tenue); font-size: 12px; font-variant-numeric: tabular-nums; }
.edu-quiz-barra { height: 5px; border-radius: 5px; background: var(--borde); overflow: hidden; margin-bottom: 12px; }
.edu-quiz-barra span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--naranja-2), var(--naranja)); transition: width .5s var(--curva-suave); }
.edu-quiz-pregunta { margin-bottom: 10px; font-weight: 600; animation: edu-entrar .35s var(--curva-suave) both; }
.edu-quiz-opciones { display: flex; flex-direction: column; gap: 6px; }
.edu-opcion {
  display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; border-radius: 11px; text-align: left;
  background: #fff; box-shadow: 0 0 0 1px var(--borde); animation: edu-entrar .35s var(--curva-suave) both; animation-delay: calc(var(--i, 0) * 50ms);
  transition: box-shadow .2s, background .2s, transform .25s var(--curva-resorte);
}
.edu-opcion:not(:disabled):hover { box-shadow: 0 0 0 1.5px var(--naranja); transform: translateX(2px); }
.edu-opcion:disabled { cursor: default; }
.edu-opcion-letra { flex: none; width: 24px; height: 24px; border-radius: 7px; display: grid; place-items: center; background: var(--fondo); font-size: 12px; font-weight: 700; color: var(--tenue); }
.edu-opcion--correcta { background: #f0fdf4; box-shadow: 0 0 0 1.5px var(--verde); animation: edu-pop .4s var(--curva-resorte); }
.edu-opcion--correcta .edu-opcion-letra { background: var(--verde); color: #fff; }
.edu-opcion--incorrecta { background: #fef2f2; box-shadow: 0 0 0 1.5px var(--rojo); animation: edu-temblar .4s ease; }
.edu-opcion--incorrecta .edu-opcion-letra { background: var(--rojo); color: #fff; }
.edu-quiz-explicacion { margin-top: 10px; padding: 10px 12px; border-radius: 10px; background: #fff; font-size: 13px; color: var(--tinta-2); box-shadow: 0 0 0 1px var(--borde); animation: edu-entrar .35s var(--curva-suave) both; }
.edu-quiz-pie { display: flex; justify-content: flex-end; margin-top: 10px; }
.edu-quiz-resultado { text-align: center; padding: 6px 0; animation: edu-pop .5s var(--curva-resorte) both; }
.edu-quiz-puntaje { font-size: 34px; font-weight: 800; letter-spacing: -.03em; background: linear-gradient(135deg, var(--naranja-2), var(--naranja-oscuro)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.edu-quiz-resultado p { margin: 2px 0 10px; color: var(--tinta-2); }

/* Botones y formularios */
.edu-boton { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 14px; border-radius: 10px; font-size: 13px; font-weight: 600; transition: transform .2s var(--curva-resorte), box-shadow .2s, background .2s, opacity .2s; }
.edu-boton:active { transform: scale(.96); }
.edu-boton:disabled { opacity: .55; cursor: default; }
.edu-boton-primario { background: var(--naranja); color: #fff !important; box-shadow: 0 6px 14px -6px rgba(255, 94, 20, .7); }
.edu-boton-primario:hover:not(:disabled) { background: var(--naranja-oscuro); }
.edu-boton-secundario { background: #fff; color: var(--tinta) !important; box-shadow: 0 0 0 1px var(--borde); }
.edu-boton-secundario:hover:not(:disabled) { box-shadow: 0 0 0 1.5px var(--naranja); }
.edu-boton-mini { padding: 5px 10px; font-size: 12px; border-radius: 8px; }
.edu-spinner { width: 14px; height: 14px; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent; animation: edu-girar .8s linear infinite; }

/* Compositor */
.edu-compositor { padding: 10px 12px 8px; background: var(--blanco); border-top: 1px solid var(--borde); }
.edu-caja { max-width: 780px; margin: 0 auto; padding: 8px 8px 6px 12px; border-radius: 16px; background: var(--fondo); box-shadow: 0 0 0 1px var(--borde); transition: box-shadow .2s ease, background .2s ease; }
.edu-caja:focus-within { background: #fff; box-shadow: 0 0 0 2px var(--naranja), 0 8px 20px -12px rgba(255, 94, 20, .5); }
.edu-entrada {
  display: block; width: 100%; min-height: 24px; max-height: 150px; resize: none; border: 0; outline: 0; background: transparent;
  font: inherit; font-size: 14px; color: var(--tinta); padding: 4px 0;
}
.edu-entrada:focus-visible { outline: none; }
.edu-entrada::placeholder { color: #9ca0ad; }
.edu-caja-barra { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 4px; }
.edu-modos { display: inline-flex; padding: 2px; border-radius: 10px; background: rgba(0, 0, 0, .05); }
.edu-modo { padding: 4px 9px; border-radius: 8px; font-size: 12px; font-weight: 600; color: var(--tenue) !important; transition: background .25s var(--curva-suave), color .2s, box-shadow .25s; }
.edu-modo[aria-checked="true"] { background: #fff; color: var(--tinta) !important; box-shadow: 0 1px 3px rgba(0, 0, 0, .12); }
.edu-caja-derecha { display: flex; align-items: center; gap: 4px; }
.edu-microfono { color: var(--tenue) !important; opacity: 1; }
.edu-microfono:hover { background: rgba(0, 0, 0, .05) !important; color: var(--tinta) !important; }
.edu-microfono--activo { color: #fff !important; background: var(--rojo) !important; animation: edu-latido 1.2s ease-in-out infinite; }
.edu-enviar {
  width: 36px; height: 36px; border-radius: 11px; display: grid; place-items: center; color: #fff !important;
  background: linear-gradient(145deg, var(--naranja-2), var(--naranja)); box-shadow: 0 6px 14px -6px rgba(255, 94, 20, .8);
  transition: transform .25s var(--curva-resorte), opacity .2s, filter .2s;
}
.edu-enviar:hover:not(:disabled) { transform: translateY(-1px) scale(1.05); }
.edu-enviar:active:not(:disabled) { transform: scale(.9); }
.edu-enviar:disabled { opacity: .4; box-shadow: none; cursor: default; filter: grayscale(.4); }
.edu-enviar--detener { background: var(--tinta); box-shadow: none; }
.edu-pie { margin-top: 6px; text-align: center; font-size: 11px; color: #a0a4b0; }

/* Vistas: ajustes y recordatorios */
.edu-vista { position: absolute; inset: 0; z-index: 3; display: flex; flex-direction: column; background: var(--blanco); animation: edu-deslizar .42s var(--curva-suave) both; }
.edu-vista--saliendo { animation: edu-deslizar-salida .28s ease-in both; }
.edu-vista-cabecera { display: flex; align-items: center; gap: 8px; padding: 14px 16px; border-bottom: 1px solid var(--borde); }
.edu-vista-cabecera h2 { margin: 0; font-size: 16px; font-weight: 700; }
.edu-vista-cabecera .edu-boton-icono { color: var(--tinta); }
.edu-vista-cabecera .edu-boton-icono:hover { background: var(--fondo); }
.edu-vista-cuerpo { flex: 1; overflow-y: auto; padding: 16px; }
.edu-seccion { margin-bottom: 22px; animation: edu-entrar .45s var(--curva-suave) both; }
.edu-seccion:nth-child(2) { animation-delay: .06s; } .edu-seccion:nth-child(3) { animation-delay: .12s; }
.edu-seccion-titulo { display: flex; align-items: center; justify-content: space-between; margin: 0 0 10px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--tenue); }
.edu-campo { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.edu-campo label { font-size: 13px; font-weight: 600; }
.edu-input { width: 100%; padding: 10px 12px; border-radius: 10px; border: 0; outline: 0; background: var(--fondo); box-shadow: 0 0 0 1px var(--borde); font: inherit; color: var(--tinta); transition: box-shadow .2s, background .2s; }
.edu-input:focus { background: #fff; box-shadow: 0 0 0 2px var(--naranja); }
.edu-telefono { display: flex; gap: 6px; }
.edu-telefono .edu-prefijo { display: grid; place-items: center; padding: 0 10px; border-radius: 10px; background: var(--fondo); box-shadow: 0 0 0 1px var(--borde); font-weight: 600; color: var(--tinta-2); }
.edu-nota { margin: 0; font-size: 12px; color: var(--tenue); }
.edu-fila { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.edu-interruptor { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--borde); font-size: 13px; cursor: pointer; }
.edu-interruptor input { appearance: none; flex: none; width: 38px; height: 22px; border-radius: 11px; background: #d4d6de; position: relative; cursor: pointer; transition: background .25s ease; margin: 0; }
.edu-interruptor input::after { content: ""; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, .25); transition: transform .3s var(--curva-resorte); }
.edu-interruptor input:checked { background: var(--naranja); }
.edu-interruptor input:checked::after { transform: translateX(16px); }
.edu-item { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--borde); animation: edu-entrar .35s var(--curva-suave) both; animation-delay: calc(var(--i, 0) * 40ms); }
.edu-item-icono { flex: none; width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; font-size: 17px; background: var(--fondo); }
.edu-item-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.edu-item-info strong { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.edu-item-info small { font-size: 12px; color: var(--tenue); }
.edu-item-info em { font-style: normal; font-size: 11.5px; color: var(--ambar); }
.edu-etiqueta { display: inline-block; padding: 1px 7px; border-radius: 6px; font-size: 11px; font-weight: 600; background: var(--fondo); color: var(--tenue); }
.edu-etiqueta--enviado { background: #dcfce7; color: #166534; }
.edu-etiqueta--error { background: #fee2e2; color: #991b1b; }
.edu-vacio { padding: 18px 12px; text-align: center; color: var(--tenue); font-size: 13px; border-radius: 12px; background: var(--fondo); }
.edu-esqueleto { height: 44px; margin-bottom: 8px; border-radius: 10px; background: linear-gradient(90deg, #f1f1f4 25%, #e7e7ec 50%, #f1f1f4 75%); background-size: 200% 100%; animation: edu-brillo 1.2s linear infinite; }

/* Aviso flotante */
.edu-toast {
  position: absolute; left: 50%; bottom: 96px; z-index: 5; transform: translateX(-50%);
  max-width: calc(100% - 32px); padding: 9px 14px; border-radius: 12px; background: var(--tinta); color: #fff; font-size: 12.5px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, .25); animation: edu-toast 3.2s var(--curva-suave) both;
}

/* Botones sobre texto seleccionado */
.edu-seleccion {
  position: fixed; z-index: 2147483002; display: flex; gap: 2px; padding: 4px; border-radius: 12px;
  background: #17181d; box-shadow: 0 10px 28px rgba(0, 0, 0, .3); animation: edu-pop .3s var(--curva-resorte) both;
}
.edu-seleccion button { padding: 6px 10px; border-radius: 8px; color: #fff !important; font-size: 12.5px; font-weight: 600; white-space: nowrap; }
.edu-seleccion button:hover { background: rgba(255, 255, 255, .12); }

/* Pantallas angostas */
@media (max-width: 560px) {
  .edu-panel, .edu-panel--expandida { right: 8px; left: 8px; width: auto; bottom: 88px; height: calc(100vh - 104px); border-radius: 18px; }
  .edu-panel--expandida { inset: 0; height: 100vh; border-radius: 0; }
  .edu-burbuja { right: 16px; bottom: 16px; }
  .edu-saludo { right: 84px; bottom: 26px; }
}

@media (prefers-reduced-motion: reduce) {
  .edu *, .edu *::before, .edu *::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important; transition-duration: 1ms !important; }
}

@keyframes edu-burbuja-entrada { from { opacity: 0; transform: scale(0) rotate(-30deg); } to { opacity: 1; transform: none; } }
@keyframes edu-halo { 0% { transform: scale(1); opacity: .5; } 100% { transform: scale(1.75); opacity: 0; } }
@keyframes edu-pop { 0% { opacity: 0; transform: scale(.6); } 100% { opacity: 1; transform: scale(1); } }
@keyframes edu-saludo-entrada { from { opacity: 0; transform: translateX(16px) scale(.85); } to { opacity: 1; transform: none; } }
@keyframes edu-saludo-salida { to { opacity: 0; transform: translateX(10px) scale(.9); } }
@keyframes edu-subir { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
@keyframes edu-entrar { from { opacity: 0; transform: translateY(8px) scale(.985); } to { opacity: 1; transform: none; } }
@keyframes edu-rebote { 0%, 60%, 100% { transform: translateY(0); opacity: .45; } 30% { transform: translateY(-5px); opacity: 1; } }
@keyframes edu-parpadeo { to { visibility: hidden; } }
@keyframes edu-girar { to { transform: rotate(360deg); } }
@keyframes edu-flotar { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
@keyframes edu-saludar { 0%, 100% { transform: rotate(0); } 15%, 45% { transform: rotate(18deg); } 30%, 60% { transform: rotate(-10deg); } }
@keyframes edu-temblar { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
@keyframes edu-latido { 0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, .45); } 50% { box-shadow: 0 0 0 6px rgba(220, 38, 38, 0); } }
@keyframes edu-deslizar { from { opacity: 0; transform: translateX(32px); } to { opacity: 1; transform: none; } }
@keyframes edu-deslizar-salida { to { opacity: 0; transform: translateX(32px); } }
@keyframes edu-brillo { to { background-position: -200% 0; } }
@keyframes edu-toast { 0% { opacity: 0; transform: translate(-50%, 10px); } 10%, 85% { opacity: 1; transform: translate(-50%, 0); } 100% { opacity: 0; transform: translate(-50%, 6px); } }
`;
