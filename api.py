"""EduIA-UPN · API del tutor académico para Blackboard.

Ejecutar:  uvicorn api:app --reload
"""
import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException, Query, Request  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import StreamingResponse  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

import almacen  # noqa: E402
import documentos  # noqa: E402
import recordatorios  # noqa: E402
import tutor  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logging.getLogger("apscheduler").setLevel(logging.WARNING)
log = logging.getLogger("eduia.api")

MAX_BYTES_DOCUMENTO = 40 * 1024 * 1024


@asynccontextmanager
async def ciclo_de_vida(_: FastAPI):
    almacen.inicializar()
    recordatorios.iniciar()
    yield
    recordatorios.detener()


app = FastAPI(title="EduIA-UPN", version="2.0.0", lifespan=ciclo_de_vida)

# Solo la extensión (y Blackboard) pueden llamar a la API desde un navegador.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=os.getenv("EDUIA_CORS_REGEX", r"^(chrome-extension://[a-p]{32}|https://upn\.blackboard\.com)$"),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/salud")
def salud():
    return {
        "ok": True,
        "modelos": tutor.MODELOS,
        "whatsapp_configurado": bool(os.getenv("TWILIO_SID") and os.getenv("TWILIO_WHATSAPP_FROM")),
    }


@app.post("/chat")
async def chat(solicitud: tutor.Solicitud):
    async def eventos():
        try:
            async for evento in tutor.responder(solicitud):
                yield json.dumps(evento, ensure_ascii=False) + "\n"
        except Exception:
            log.exception("Error inesperado en /chat")
            yield json.dumps({"t": "error", "v": "Ocurrió un error inesperado. Toca «Reintentar»."}) + "\n"

    return StreamingResponse(
        eventos(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/documentos")
async def subir_documento(
    request: Request,
    nombre: str = Query("documento", max_length=300),
    mime: str = Query("", max_length=150),
):
    datos = await request.body()
    if not datos:
        raise HTTPException(400, "El archivo llegó vacío.")
    if len(datos) > MAX_BYTES_DOCUMENTO:
        raise HTTPException(413, "El archivo supera los 40 MB.")
    try:
        return await asyncio.to_thread(documentos.procesar, nombre, mime, datos)
    except documentos.DocumentoInvalido as e:
        raise HTTPException(422, str(e))
    except Exception:
        log.exception("No se pudo procesar %s", nombre)
        raise HTTPException(422, "No se pudo leer el archivo.")


class NuevoRecordatorio(BaseModel):
    alumno: str = Field(min_length=1, max_length=120)
    whatsapp: str = ""
    mensaje: str = Field(min_length=1, max_length=500)
    tipo: str = "otro"
    fecha_hora: str


@app.get("/recordatorios")
def listar_recordatorios(alumno: str = Query(min_length=1, max_length=120)):
    return recordatorios.listar(alumno)


@app.post("/recordatorios")
def crear_recordatorio(datos: NuevoRecordatorio):
    try:
        rec = recordatorios.crear(datos.alumno, datos.whatsapp, datos.mensaje, datos.tipo, datos.fecha_hora)
    except recordatorios.ErrorRecordatorio as e:
        raise HTTPException(422, str(e))
    return rec | {"aviso": recordatorios.confirmar(rec, datos.whatsapp)}


@app.delete("/recordatorios/{recordatorio_id}")
def cancelar_recordatorio(recordatorio_id: int, alumno: str = Query(min_length=1, max_length=120)):
    if not recordatorios.cancelar(alumno, recordatorio_id):
        raise HTTPException(404, "No encontré ese recordatorio pendiente.")
    return {"ok": True}


class PruebaWhatsApp(BaseModel):
    whatsapp: str = ""
    nombre: str = ""


@app.post("/whatsapp/prueba")
def probar_whatsapp(datos: PruebaWhatsApp):
    try:
        telefono = recordatorios.telefono_para(datos.whatsapp)
        saludo = f", {datos.nombre}" if datos.nombre else ""
        recordatorios.enviar_whatsapp(
            telefono, f"👋 ¡Hola{saludo}! Soy *EduIA-UPN*. Así te llegarán tus recordatorios de exámenes, tareas y clases. 🎓"
        )
    except recordatorios.ErrorRecordatorio as e:
        raise HTTPException(422, str(e))
    return {"ok": True, "telefono": recordatorios.telefono_oculto(telefono)}


class Valoracion(BaseModel):
    util: bool
    modelo: str = ""
    tipo_pagina: str = ""
    comentario: str = Field("", max_length=500)


@app.post("/valoraciones")
def valorar(valoracion: Valoracion):
    almacen.registrar_valoracion(valoracion.util, valoracion.modelo, valoracion.tipo_pagina, valoracion.comentario)
    return {"ok": True}


@app.get("/metricas")
def ver_metricas(dias: int = Query(7, ge=1, le=365)):
    """Uso agregado y anónimo (sin contenido de las conversaciones), pensado para la universidad."""
    return almacen.metricas(dias)
