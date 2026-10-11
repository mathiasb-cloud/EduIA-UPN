"""Persistencia local en SQLite: recordatorios, métricas de uso y valoraciones."""
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

RUTA_DB = Path(__file__).parent / "datos" / "eduia.db"

ESQUEMA = """
CREATE TABLE IF NOT EXISTS recordatorios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alumno TEXT NOT NULL,
    telefono TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'otro',
    enviar_en TEXT NOT NULL,            -- ISO 8601 en UTC
    estado TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | enviando | enviado | error | cancelado
    error TEXT,
    sid TEXT,
    creado_en TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recordatorios_estado ON recordatorios (estado, enviar_en);

CREATE TABLE IF NOT EXISTS consultas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creado_en TEXT NOT NULL,
    modo TEXT,
    modelo TEXT,
    tipo_pagina TEXT,
    ms_primer_token INTEGER,
    ms_total INTEGER,
    uso_herramientas INTEGER DEFAULT 0,
    con_documento INTEGER DEFAULT 0,
    error TEXT
);

CREATE TABLE IF NOT EXISTS valoraciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creado_en TEXT NOT NULL,
    util INTEGER NOT NULL,
    modelo TEXT,
    tipo_pagina TEXT,
    comentario TEXT
);
"""


def ahora_utc() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@contextmanager
def conexion():
    RUTA_DB.parent.mkdir(exist_ok=True)
    con = sqlite3.connect(RUTA_DB, timeout=10)
    con.row_factory = sqlite3.Row
    try:
        with con:
            yield con
    finally:
        con.close()


def inicializar():
    with conexion() as con:
        con.executescript(ESQUEMA)


def registrar_consulta(**campos):
    campos["creado_en"] = ahora_utc()
    columnas = ", ".join(campos)
    marcas = ", ".join("?" for _ in campos)
    with conexion() as con:
        con.execute(f"INSERT INTO consultas ({columnas}) VALUES ({marcas})", tuple(campos.values()))


def registrar_valoracion(util: bool, modelo: str, tipo_pagina: str, comentario: str):
    with conexion() as con:
        con.execute(
            "INSERT INTO valoraciones (creado_en, util, modelo, tipo_pagina, comentario) VALUES (?, ?, ?, ?, ?)",
            (ahora_utc(), int(util), modelo, tipo_pagina, comentario[:500]),
        )


def metricas(dias: int = 7) -> dict:
    desde = (datetime.now(timezone.utc) - timedelta(days=dias)).isoformat(timespec="seconds")
    with conexion() as con:
        consultas = con.execute(
            """SELECT COUNT(*) AS total, AVG(ms_primer_token) AS ms_primer_token, AVG(ms_total) AS ms_total,
                      SUM(uso_herramientas) AS con_herramientas, SUM(con_documento) AS con_documento,
                      SUM(error IS NOT NULL) AS errores
               FROM consultas WHERE creado_en >= ?""",
            (desde,),
        ).fetchone()
        por_pagina = con.execute(
            "SELECT tipo_pagina, COUNT(*) AS total FROM consultas WHERE creado_en >= ? GROUP BY tipo_pagina ORDER BY total DESC",
            (desde,),
        ).fetchall()
        valoraciones = con.execute(
            "SELECT COUNT(*) AS total, SUM(util) AS utiles FROM valoraciones WHERE creado_en >= ?", (desde,)
        ).fetchone()
        recordatorios = con.execute(
            "SELECT estado, COUNT(*) AS total FROM recordatorios WHERE creado_en >= ? GROUP BY estado", (desde,)
        ).fetchall()
    return {
        "periodo_dias": dias,
        "consultas": dict(consultas),
        "consultas_por_tipo_de_pagina": {f["tipo_pagina"] or "otro": f["total"] for f in por_pagina},
        "valoraciones": dict(valoraciones),
        "recordatorios_por_estado": {f["estado"]: f["total"] for f in recordatorios},
    }
