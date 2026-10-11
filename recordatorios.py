"""Recordatorios por WhatsApp (Twilio): se guardan en SQLite y un planificador los envía a su hora."""
import json
import logging
import os
import re
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from twilio.base.exceptions import TwilioRestException
from twilio.rest import Client

import almacen

log = logging.getLogger("eduia.recordatorios")

ZONA = ZoneInfo(os.getenv("EDUIA_ZONA_HORARIA", "America/Lima"))
EMOJI_TIPO = {"examen": "📝", "tarea": "📚", "clase": "🎥", "blackboard": "💻", "estudio": "🧠", "otro": "⏰"}
DIAS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]
MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

ERRORES_TWILIO = {
    63015: "Tu número aún no está unido al canal de WhatsApp de EduIA. Envía el mensaje de activación (join …) al número de EduIA y vuelve a intentarlo.",
    63016: "WhatsApp solo permite mensajes libres dentro de las 24 h siguientes a tu último mensaje al número de EduIA. Escríbele «hola» a ese número (o configura una plantilla aprobada con TWILIO_CONTENT_SID).",
    63007: "El número emisor de WhatsApp del servidor no es válido (TWILIO_WHATSAPP_FROM).",
    63003: "El número de destino no tiene WhatsApp.",
    21211: "El número de WhatsApp de destino no es válido.",
    21608: "Ese número no está autorizado en la cuenta de prueba de Twilio.",
    20003: "Las credenciales de Twilio del servidor no son válidas.",
}

planificador = BackgroundScheduler(timezone=timezone.utc)


class ErrorRecordatorio(Exception):
    """Error con un mensaje apto para mostrar al alumno."""


# ---------- Utilidades ----------

def normalizar_telefono(texto: str | None) -> str | None:
    digitos = re.sub(r"\D", "", texto or "")
    if len(digitos) == 9 and digitos.startswith("9"):  # celular peruano sin código de país
        return f"+51{digitos}"
    if 10 <= len(digitos) <= 15:
        return f"+{digitos}"
    return None


def telefono_oculto(telefono: str) -> str:
    return f"{telefono[:3]} ••• ••• {telefono[-3:]}"


def fecha_legible(fecha: datetime) -> str:
    local = fecha.astimezone(ZONA)
    hora = local.strftime("%I:%M").lstrip("0")
    sufijo = "a. m." if local.hour < 12 else "p. m."
    return f"{DIAS[local.weekday()]} {local.day} {MESES[local.month - 1]} {local.year}, {hora} {sufijo}"


def interpretar_fecha(texto: str) -> datetime:
    try:
        fecha = datetime.fromisoformat(texto.strip().replace("Z", "+00:00"))
    except ValueError as e:
        raise ErrorRecordatorio("No entendí la fecha y hora del recordatorio.") from e
    if fecha.tzinfo is None:
        fecha = fecha.replace(tzinfo=ZONA)
    return fecha.astimezone(timezone.utc)


def _a_dict(fila) -> dict:
    fecha = datetime.fromisoformat(fila["enviar_en"])
    return {
        "id": fila["id"],
        "mensaje": fila["mensaje"],
        "tipo": fila["tipo"],
        "estado": fila["estado"],
        "error": fila["error"],
        "telefono": telefono_oculto(fila["telefono"]),
        "enviar_en": fecha.astimezone(ZONA).isoformat(timespec="minutes"),
        "enviar_en_legible": fecha_legible(fecha),
    }


# ---------- WhatsApp ----------

@lru_cache(maxsize=1)
def _cliente() -> Client:
    sid, token = os.getenv("TWILIO_SID"), os.getenv("TWILIO_TOKEN")
    if not (sid and token):
        raise ErrorRecordatorio("WhatsApp no está configurado en el servidor (faltan TWILIO_SID y TWILIO_TOKEN).")
    return Client(sid, token)


def enviar_whatsapp(telefono: str, texto: str) -> str:
    origen = os.getenv("TWILIO_WHATSAPP_FROM")
    if not origen:
        raise ErrorRecordatorio("Falta TWILIO_WHATSAPP_FROM en el archivo .env del servidor.")
    parametros = {"from_": origen, "to": f"whatsapp:{telefono}"}
    if plantilla := os.getenv("TWILIO_CONTENT_SID"):
        parametros |= {"content_sid": plantilla, "content_variables": json.dumps({"1": texto})}
    else:
        parametros["body"] = texto
    try:
        return _cliente().messages.create(**parametros).sid
    except TwilioRestException as e:
        raise ErrorRecordatorio(ERRORES_TWILIO.get(e.code, f"Twilio rechazó el mensaje (código {e.code}).")) from e


def _texto_recordatorio(fila) -> str:
    emoji = EMOJI_TIPO.get(fila["tipo"], "⏰")
    fecha = fecha_legible(datetime.fromisoformat(fila["enviar_en"]))
    return f"{emoji} *Recordatorio de EduIA-UPN*\n\n{fila['mensaje']}\n🗓️ {fecha}\n\n👉 Entra a Blackboard: https://upn.blackboard.com"


# ---------- Operaciones ----------

def telefono_para(telefono_alumno: str | None) -> str:
    telefono = normalizar_telefono(telefono_alumno) or normalizar_telefono(os.getenv("WHATSAPP_DESTINO_PREDETERMINADO"))
    if not telefono:
        raise ErrorRecordatorio("Falta tu número de WhatsApp. Agrégalo en ⚙️ Ajustes de EduIA.")
    return telefono


def crear(alumno: str, telefono: str | None, mensaje: str, tipo: str, fecha_hora: str) -> dict:
    destino = telefono_para(telefono)
    fecha = interpretar_fecha(fecha_hora)
    ahora = datetime.now(timezone.utc)
    if fecha < ahora - timedelta(minutes=1):
        raise ErrorRecordatorio(f"Esa fecha ya pasó ({fecha_legible(fecha)}).")
    if fecha > ahora + timedelta(days=366):
        raise ErrorRecordatorio("Solo puedo programar recordatorios dentro del próximo año.")
    tipo = tipo if tipo in EMOJI_TIPO else "otro"
    with almacen.conexion() as con:
        cursor = con.execute(
            "INSERT INTO recordatorios (alumno, telefono, mensaje, tipo, enviar_en, creado_en) VALUES (?, ?, ?, ?, ?, ?)",
            (alumno, destino, mensaje.strip()[:500], tipo, fecha.isoformat(timespec="seconds"), almacen.ahora_utc()),
        )
        fila = con.execute("SELECT * FROM recordatorios WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return _a_dict(fila)


def confirmar(recordatorio: dict, telefono: str | None) -> str | None:
    """Envía un WhatsApp de confirmación. Devuelve None si salió bien o el motivo del fallo."""
    if os.getenv("EDUIA_CONFIRMAR_WHATSAPP", "1") == "0":
        return None
    texto = (
        f"✅ *EduIA-UPN* programó tu recordatorio\n\n{recordatorio['mensaje']}\n"
        f"🗓️ {recordatorio['enviar_en_legible']}\n\nTe escribiré a esa hora por aquí."
    )
    try:
        enviar_whatsapp(telefono_para(telefono), texto)
        return None
    except ErrorRecordatorio as e:
        return str(e)


def listar(alumno: str) -> list[dict]:
    with almacen.conexion() as con:
        filas = con.execute(
            """SELECT * FROM recordatorios WHERE alumno = ? AND (estado IN ('pendiente', 'enviando')
                   OR enviar_en >= ?) AND estado != 'cancelado'
               ORDER BY enviar_en LIMIT 50""",
            (alumno, (datetime.now(timezone.utc) - timedelta(days=3)).isoformat(timespec="seconds")),
        ).fetchall()
    return [_a_dict(f) for f in filas]


def cancelar(alumno: str, recordatorio_id: int) -> bool:
    with almacen.conexion() as con:
        cursor = con.execute(
            "UPDATE recordatorios SET estado = 'cancelado' WHERE id = ? AND alumno = ? AND estado = 'pendiente'",
            (recordatorio_id, alumno),
        )
    return cursor.rowcount > 0


# ---------- Planificador ----------

def _despachar():
    ahora = almacen.ahora_utc()
    with almacen.conexion() as con:
        filas = con.execute(
            "SELECT * FROM recordatorios WHERE estado = 'pendiente' AND enviar_en <= ?", (ahora,)
        ).fetchall()
    for fila in filas:
        with almacen.conexion() as con:
            tomado = con.execute(
                "UPDATE recordatorios SET estado = 'enviando' WHERE id = ? AND estado = 'pendiente'", (fila["id"],)
            ).rowcount
        if not tomado:
            continue
        sid, error = None, None
        try:
            sid = enviar_whatsapp(fila["telefono"], _texto_recordatorio(fila))
        except ErrorRecordatorio as e:
            error = str(e)
            log.warning("Recordatorio %s no enviado: %s", fila["id"], error)
        with almacen.conexion() as con:
            con.execute(
                "UPDATE recordatorios SET estado = ?, error = ?, sid = ? WHERE id = ?",
                ("error" if error else "enviado", error, sid, fila["id"]),
            )
        if sid:
            planificador.add_job(
                _verificar_entrega, "date", run_date=datetime.now(timezone.utc) + timedelta(seconds=20), args=[fila["id"], sid]
            )


def _verificar_entrega(recordatorio_id: int, sid: str):
    """WhatsApp informa algunos rechazos (p. ej. fuera de la ventana de 24 h) segundos después del envío."""
    try:
        mensaje = _cliente().messages(sid).fetch()
    except Exception:
        return
    if mensaje.status in ("failed", "undelivered"):
        error = ERRORES_TWILIO.get(mensaje.error_code, f"WhatsApp no entregó el mensaje (código {mensaje.error_code}).")
        with almacen.conexion() as con:
            con.execute("UPDATE recordatorios SET estado = 'error', error = ? WHERE id = ?", (error, recordatorio_id))


def iniciar():
    with almacen.conexion() as con:
        con.execute("UPDATE recordatorios SET estado = 'pendiente' WHERE estado = 'enviando'")
    planificador.add_job(_despachar, "interval", seconds=15, id="despachar", replace_existing=True, max_instances=1, coalesce=True)
    planificador.start()


def detener():
    planificador.shutdown(wait=False)
