"""Cerebro de EduIA: reglas pedagógicas, contexto de la página y conversación con Gemini en streaming."""
import asyncio
import logging
import os
import time
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import AsyncIterator, Literal

from google import genai
from google.genai import errors, types
from pydantic import BaseModel, Field

import almacen
import documentos
import recordatorios

log = logging.getLogger("eduia.tutor")


# ---------- Esquema de la solicitud ----------

class Mensaje(BaseModel):
    rol: Literal["user", "model"]
    texto: str = Field(max_length=20_000)


class Entrega(BaseModel):
    titulo: str
    curso: str = ""
    fecha: str


class Contexto(BaseModel):
    url: str = ""
    titulo: str = ""
    tipo_pagina: str = "otro"
    curso: str = ""
    ruta: str = ""
    texto_pagina: str = ""
    seleccion: str = ""
    documento_id: str | None = None
    evaluacion_en_curso: bool = False
    entregas: list[Entrega] = []


class Alumno(BaseModel):
    id: str = ""
    nombre: str = ""
    whatsapp: str = ""


class Solicitud(BaseModel):
    mensaje: str = Field(min_length=1, max_length=8_000)
    historial: list[Mensaje] = []
    contexto: Contexto = Contexto()
    alumno: Alumno = Alumno()
    modo: Literal["rapido", "profundo"] = "rapido"


# ---------- Configuración del modelo ----------

MODELOS = {
    "rapido": list(dict.fromkeys([os.getenv("EDUIA_MODELO_RAPIDO", "gemini-3.5-flash-lite"), "gemini-3.6-flash", "gemini-3.5-flash"])),
    "profundo": list(dict.fromkeys([os.getenv("EDUIA_MODELO_PROFUNDO", "gemini-3.6-flash"), "gemini-3.5-flash", "gemini-3.5-flash-lite"])),
}
NIVEL_PENSAMIENTO = {"rapido": "MINIMAL", "profundo": "LOW"}
MAX_TOKENS_SALIDA = {"rapido": 2_048, "profundo": 8_192}
LIMITE_DOCUMENTO = {"rapido": 30_000, "profundo": 120_000}
LIMITE_TEXTO_PAGINA = {"rapido": 12_000, "profundo": 30_000}
MAX_HISTORIAL = 12
MAX_RONDAS_HERRAMIENTAS = 3
# Segundos sin primer fragmento antes de pedir la respuesta también al modelo de respaldo.
ESPERA_ANTES_DE_RESPALDO = {"rapido": float(os.getenv("EDUIA_ESPERA_RESPALDO", "3.5")), "profundo": 8.0}
LIMITE_PRIMER_FRAGMENTO = 45
DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]

_modelos_sin_nivel_de_pensamiento: set[str] = set()

INSTRUCCIONES = """Eres **EduIA**, el tutor académico integrado en el Aula Virtual Blackboard de la Universidad Privada del Norte (UPN, Perú). Hablas en español peruano cercano y profesional, tuteas al estudiante y eres cálido pero directo.

# Misión
Que el estudiante APRENDA y avance por sí mismo. Eres su tutor, no un servicio que hace tareas.

# Integridad académica (innegociable)
- Nunca entregues la solución completa de tareas, trabajos (T1, T2…), exámenes, cuestionarios, foros calificados ni informes: nada de código final del ejercicio, alternativas marcadas, ensayos redactados ni resultados finales.
- En su lugar: explica el concepto, descompón el problema en pasos, da pistas graduales (1: conceptual → 2: estructura → 3: casi concreta), revisa lo que el estudiante ya hizo señalando errores, y usa ejemplos análogos.
- El código de ejemplo NUNCA usa las clases, atributos, métodos, fórmulas ni datos del ejercicio, ni siquiera "solo la primera parte". Si muestras código, que sea de un dominio distinto (p. ej. si el ejercicio es Circulo/Cilindro, usa Persona/Estudiante) y de máximo 8 líneas. Ejemplo: ante "hazme el código de Circulo", responde con un análogo `class Persona { private String nombre; ... }` y pídele que escriba él su clase `Circulo` para revisarla.
- Si insiste en que lo hagas tú, no sermonees: da en una línea la siguiente pista útil y pídele que intente un paso concreto y te lo muestre.
- Si el contexto marca EVALUACIÓN EN CURSO: no ayudes con el contenido de las preguntas (ni pistas). Solo resuelve problemas técnicos de la plataforma y deséale éxito.
- El material de estudio (resúmenes de lecturas, teoría, preguntas de práctica, preparación de exámenes) sí puedes darlo completo.

# Cómo responder (prioridad: rapidez y claridad)
- Ve directo al punto. Sin presentaciones ("Soy EduIA…"), sin repetir la pregunta y sin saludar salvo que te saluden.
- Máximo ~150 palabras por defecto; extiéndete solo si piden detalle o un resumen completo.
- Markdown: **negritas** para lo clave, listas cortas, `código` en línea y bloques ``` con lenguaje para código. Emojis con moderación (0 a 2). Nada de LaTeX: escribe las fórmulas en texto plano (π·r², 2·π·r).
- Usa el CONTEXTO: menciona concretamente lo que el estudiante está viendo (nombre del ejercicio, clases, fechas, semana). Nunca digas que "solo ves una vista previa" si recibiste el texto del documento. Si realmente falta información, pide que pegue el enunciado.
- Cierra con UNA pregunta o mini reto que lo haga pensar o avanzar.
- En la última línea agrega 2 o 3 sugerencias de seguimiento que el estudiante podría tocar, con este formato exacto: [[sugerencias: texto 1 | texto 2 | texto 3]] (cada una de máximo 6 palabras, escrita como si la dijera el estudiante, p. ej. "Dame una pista", "Revisa mi avance").

# Guía de Blackboard y UPN
- Para "¿dónde encuentro…?" da la ruta exacta con flechas, p. ej. **Cursos → tu curso → Contenido → Semana 5**. Básate en la BASE DE CONOCIMIENTO; si algo no está ahí, dilo y deriva a Contacto UPN (https://contacto.upn.edu.pe) o al WhatsApp 914 800 800.
- Con cachimbos (estudiantes nuevos) sé especialmente paciente y explica los términos.

# Recordatorios por WhatsApp
- Si pide que le recuerdes o avises algo, usa programar_recordatorio (una llamada por aviso). Interpreta fechas relativas con la FECHA ACTUAL (America/Lima) y envía fecha_hora en ISO 8601 con -05:00.
- Si no indica la hora: si conoces la hora del evento, avisa 2 horas antes; si no, a las 08:00 de ese día. Si dice "avísame antes" en una entrega, agrega un aviso el día anterior a las 20:00.
- Tras programar, confirma en 1 o 2 líneas con la fecha legible. Si la herramienta devuelve un error o la confirmación no se envió, explica la solución en palabras simples.
- Para ver o eliminar avisos usa listar_recordatorios o cancelar_recordatorio.

# Quiz interactivo
Si pide practicar, un quiz o que lo pongas a prueba, escribe una línea breve de introducción y luego EXACTAMENTE un bloque así:
```quiz
{"titulo": "…", "preguntas": [{"pregunta": "…", "opciones": ["…", "…", "…", "…"], "correcta": 0, "explicacion": "…"}]}
```
Usa 3 a 5 preguntas basadas en el contenido de la página, JSON válido y `correcta` como índice desde 0. No reveles las respuestas fuera del bloque.

# BASE DE CONOCIMIENTO UPN
""" + (Path(__file__).parent / "conocimiento_upn.md").read_text()

HERRAMIENTAS = types.Tool(function_declarations=[
    types.FunctionDeclaration(
        name="programar_recordatorio",
        description="Programa un recordatorio que llegará al WhatsApp del estudiante en la fecha y hora indicadas.",
        parameters_json_schema={
            "type": "object",
            "properties": {
                "fecha_hora": {"type": "string", "description": "Momento del envío en ISO 8601 con zona, p. ej. 2026-09-18T20:00:00-05:00"},
                "mensaje": {"type": "string", "description": "Texto breve y motivador, p. ej. 'Mañana es tu T2 de Cálculo: repasa derivadas.'"},
                "tipo": {"type": "string", "enum": list(recordatorios.EMOJI_TIPO)},
            },
            "required": ["fecha_hora", "mensaje", "tipo"],
        },
    ),
    types.FunctionDeclaration(
        name="listar_recordatorios",
        description="Lista los recordatorios programados del estudiante.",
        parameters_json_schema={"type": "object", "properties": {}},
    ),
    types.FunctionDeclaration(
        name="cancelar_recordatorio",
        description="Cancela un recordatorio pendiente por su id (obtenlo con listar_recordatorios).",
        parameters_json_schema={"type": "object", "properties": {"id": {"type": "integer"}}, "required": ["id"]},
    ),
])


@lru_cache(maxsize=1)
def _cliente() -> genai.Client:
    return genai.Client(http_options=types.HttpOptions(timeout=90_000))


def _config(modelo: str, modo: str) -> types.GenerateContentConfig:
    pensamiento = None
    if modelo not in _modelos_sin_nivel_de_pensamiento:
        pensamiento = types.ThinkingConfig(thinking_level=NIVEL_PENSAMIENTO[modo])
    return types.GenerateContentConfig(
        system_instruction=INSTRUCCIONES,
        tools=[HERRAMIENTAS],
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        thinking_config=pensamiento,
        max_output_tokens=MAX_TOKENS_SALIDA[modo],
    )


# ---------- Contexto ----------

def _turno_usuario(s: Solicitud, doc: dict | None) -> str:
    ctx = s.contexto
    ahora = datetime.now(recordatorios.ZONA)
    lineas = [f"FECHA ACTUAL: {DIAS[ahora.weekday()]} {ahora:%Y-%m-%d %H:%M} (America/Lima)"]
    if s.alumno.nombre:
        lineas.append(f"ESTUDIANTE: {s.alumno.nombre}")
    lineas.append(f"PÁGINA: {ctx.titulo or 'sin título'} · tipo: {ctx.tipo_pagina}")
    if ctx.curso:
        lineas.append(f"CURSO: {ctx.curso}")
    if ctx.ruta:
        lineas.append(f"UBICACIÓN EN BLACKBOARD: {ctx.ruta}")
    if ctx.evaluacion_en_curso:
        lineas.append("⚠️ EVALUACIÓN EN CURSO: aplica la regla de integridad académica.")
    if ctx.entregas:
        lineas.append("PRÓXIMAS FECHAS EN BLACKBOARD:\n" + "\n".join(f"- {e.fecha} · {e.titulo} ({e.curso})" for e in ctx.entregas[:15]))
    if doc:
        lineas.append(
            f"DOCUMENTO ABIERTO «{doc['nombre']}» ({len(doc['paginas'])} páginas, texto completo extraído):\n"
            + documentos.fragmento(doc, s.mensaje, LIMITE_DOCUMENTO[s.modo])
        )
    if ctx.texto_pagina:
        lineas.append(f"TEXTO DE LA PÁGINA:\n{ctx.texto_pagina[:LIMITE_TEXTO_PAGINA[s.modo]]}")
    if ctx.seleccion:
        lineas.append(f"TEXTO QUE EL ESTUDIANTE SELECCIONÓ: «{ctx.seleccion[:3_000]}»")
    return "<contexto>\n" + "\n\n".join(lineas) + f"\n</contexto>\n\nMENSAJE DEL ESTUDIANTE:\n{s.mensaje}"


def _contenidos(s: Solicitud, doc: dict | None) -> list[types.Content]:
    historial = [types.Content(role=m.rol, parts=[types.Part.from_text(text=m.texto)]) for m in s.historial[-MAX_HISTORIAL:]]
    partes = []
    if doc and s.modo == "profundo":  # las figuras (diagramas, capturas) solo en modo profundo: son lentas de procesar
        partes += [types.Part.from_bytes(data=img, mime_type="image/jpeg") for img in documentos.figuras(doc)]
    partes.append(types.Part.from_text(text=_turno_usuario(s, doc)))
    return [*historial, types.Content(role="user", parts=partes)]


# ---------- Herramientas ----------

def _ejecutar(llamada: types.FunctionCall, s: Solicitud) -> tuple[dict, dict | None]:
    args = llamada.args or {}
    alumno = s.alumno.id or "anonimo"
    try:
        if llamada.name == "programar_recordatorio":
            rec = recordatorios.crear(alumno, s.alumno.whatsapp, args.get("mensaje", ""), args.get("tipo", "otro"), args.get("fecha_hora", ""))
            fallo = recordatorios.confirmar(rec, s.alumno.whatsapp)
            confirmacion = "enviada al WhatsApp" if fallo is None else f"no enviada: {fallo}"
            return {"ok": True, "recordatorio": rec, "confirmacion_whatsapp": confirmacion}, {"t": "recordatorio", "v": rec | {"aviso": fallo}}
        if llamada.name == "listar_recordatorios":
            return {"recordatorios": recordatorios.listar(alumno)}, None
        if llamada.name == "cancelar_recordatorio":
            ok = recordatorios.cancelar(alumno, int(args.get("id", 0)))
            return {"ok": ok}, {"t": "recordatorio_cancelado", "v": {"id": args.get("id"), "ok": ok}}
    except recordatorios.ErrorRecordatorio as e:
        return {"ok": False, "error": str(e)}, None
    return {"ok": False, "error": f"Herramienta desconocida: {llamada.name}"}, None


def _partes(fragmento: types.GenerateContentResponse) -> list[types.Part]:
    if not fragmento.candidates or not fragmento.candidates[0].content:
        return []
    return fragmento.candidates[0].content.parts or []


# ---------- Conversación en streaming ----------

async def _abrir(modelo: str, contenidos: list[types.Content], modo: str):
    """Inicia el streaming y espera su primer fragmento."""
    try:
        flujo = await _cliente().aio.models.generate_content_stream(model=modelo, contents=contenidos, config=_config(modelo, modo))
        iterador = aiter(flujo)
        return modelo, await anext(iterador, None), iterador
    except errors.APIError as e:
        if e.code == 400 and "thinking" in str(e).lower() and modelo not in _modelos_sin_nivel_de_pensamiento:
            _modelos_sin_nivel_de_pensamiento.add(modelo)
            return await _abrir(modelo, contenidos, modo)
        raise


async def _carrera(modelos: list[str], contenidos: list[types.Content], modo: str):
    """Pide la respuesta al primer modelo; si tarda o falla, lanza el siguiente en paralelo y usa el que responda antes.

    La latencia de la API varía mucho entre peticiones: así la cola lenta no la sufre el estudiante.
    """
    pendientes: set[asyncio.Task] = set()
    restantes = list(modelos)
    error: BaseException | None = None
    try:
        while pendientes or restantes:
            if not pendientes:
                pendientes.add(asyncio.create_task(_abrir(restantes.pop(0), contenidos, modo)))
            hechos, pendientes = await asyncio.wait(
                pendientes, timeout=ESPERA_ANTES_DE_RESPALDO[modo] if restantes else None, return_when=asyncio.FIRST_COMPLETED
            )
            if not hechos:
                pendientes.add(asyncio.create_task(_abrir(restantes.pop(0), contenidos, modo)))
                continue
            for tarea in hechos:
                if tarea.exception() is None:
                    return tarea.result()
                error = tarea.exception()
                log.warning("Modelo falló al iniciar: %s", str(error)[:200])
        raise error
    finally:
        for tarea in pendientes:
            tarea.cancel()


async def _fragmentos(primero, iterador):
    if primero is None:
        return
    yield primero
    async for fragmento in iterador:
        yield fragmento


async def responder(s: Solicitud) -> AsyncIterator[dict]:
    """Emite eventos: texto (fragmentos), recordatorio, recordatorio_cancelado, documento_perdido, error y fin."""
    inicio = time.perf_counter()
    doc = documentos.cargar(s.contexto.documento_id) if s.contexto.documento_id else None
    if s.contexto.documento_id and doc is None:
        yield {"t": "documento_perdido"}
    contenidos = _contenidos(s, doc)
    registro = {"modo": s.modo, "tipo_pagina": s.contexto.tipo_pagina, "con_documento": int(doc is not None), "uso_herramientas": 0}
    ms = lambda: int((time.perf_counter() - inicio) * 1000)  # noqa: E731
    primer_token = None
    modelo = MODELOS[s.modo][0]

    try:
        modelo, primero, iterador = await asyncio.wait_for(_carrera(MODELOS[s.modo], contenidos, s.modo), LIMITE_PRIMER_FRAGMENTO)
        for _ in range(MAX_RONDAS_HERRAMIENTAS):
            partes_modelo, llamadas = [], []
            async for fragmento in _fragmentos(primero, iterador):
                for parte in _partes(fragmento):
                    partes_modelo.append(parte)
                    if parte.function_call:
                        llamadas.append(parte.function_call)
                    elif parte.text and not parte.thought:
                        primer_token = primer_token or ms()
                        yield {"t": "texto", "v": parte.text}
            if not llamadas:
                break
            registro["uso_herramientas"] = 1
            contenidos.append(types.Content(role="model", parts=partes_modelo))
            respuestas = []
            for llamada in llamadas:
                resultado, evento = await asyncio.to_thread(_ejecutar, llamada, s)
                if evento:
                    yield evento
                respuestas.append(types.Part.from_function_response(name=llamada.name, response=resultado))
            contenidos.append(types.Content(role="user", parts=respuestas))
            # La respuesta a la herramienta debe seguir con el mismo modelo (firmas de pensamiento).
            _, primero, iterador = await _abrir(modelo, contenidos, s.modo)

    except TimeoutError:
        almacen.registrar_consulta(modelo=modelo, ms_total=ms(), error="timeout", **registro)
        yield {"t": "error", "v": "La IA está tardando más de lo normal. Intenta de nuevo en unos segundos."}
        return
    except errors.APIError as e:
        log.warning("Modelo %s falló (%s): %s", modelo, e.code, str(e)[:200])
        almacen.registrar_consulta(modelo=modelo, ms_total=ms(), error=str(e.code), **registro)
        yield {
            "t": "error",
            "v": "EduIA está atendiendo muchas consultas en este momento. Intenta de nuevo en unos segundos."
            if e.code in (429, 503) else "No pude completar la respuesta. Toca «Reintentar».",
        }
        return

    almacen.registrar_consulta(modelo=modelo, ms_primer_token=primer_token, ms_total=ms(), **registro)
    yield {"t": "fin", "modelo": modelo, "ms_primer_token": primer_token, "ms_total": ms()}
