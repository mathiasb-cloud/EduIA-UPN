"""Extracción y caché del texto de los archivos que el alumno abre en Blackboard (PDF, Word, PowerPoint)."""
import hashlib
import html
import json
import re
import unicodedata
import zipfile
from io import BytesIO
from pathlib import Path

import pypdfium2 as pdfium
import pypdfium2.raw as pdfium_c

CARPETA = Path(__file__).parent / "datos" / "documentos"
MAX_PAGINAS_CON_FIGURAS = 3
MAX_EN_MEMORIA = 64

_cache: dict[str, dict] = {}


class DocumentoInvalido(ValueError):
    pass


def _tipo(nombre: str, mime: str, datos: bytes) -> str:
    if datos[:5] == b"%PDF-":
        return "pdf"
    if datos[:2] == b"PK":
        with zipfile.ZipFile(BytesIO(datos)) as zf:
            nombres = zf.namelist()
        if "word/document.xml" in nombres:
            return "docx"
        if any(n.startswith("ppt/slides/slide") for n in nombres):
            return "pptx"
    inicio = datos[:200].lstrip().lower()
    if inicio.startswith((b"<!doctype html", b"<html")):
        # Normalmente es la página de login: la sesión de Blackboard no acompañó la descarga.
        raise DocumentoInvalido("La descarga devolvió una página web, no un archivo.")
    if mime.startswith("text/") or nombre.lower().endswith((".txt", ".md", ".csv", ".java", ".py")):
        return "texto"
    raise DocumentoInvalido(f"Formato no soportado: {mime or nombre}")


def _texto_xml(xml: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", xml))


def _pdf(datos: bytes, doc_id: str) -> tuple[list[str], list[int]]:
    pdf = pdfium.PdfDocument(datos)
    paginas, con_imagenes = [], []
    for i, pagina in enumerate(pdf):
        paginas.append(pagina.get_textpage().get_text_bounded().replace("\r\n", "\n"))
        if next(pagina.get_objects(filter=(pdfium_c.FPDF_PAGEOBJ_IMAGE,), max_depth=2), None):
            con_imagenes.append(i)

    escaneado = sum(len(p.strip()) for p in paginas) < 40 * len(paginas)
    candidatas = list(range(len(paginas))) if escaneado else con_imagenes
    figuras = []
    for i in candidatas[:MAX_PAGINAS_CON_FIGURAS]:
        imagen = pdf[i].render(scale=1.1).to_pil().convert("RGB")
        imagen.thumbnail((1100, 1100))
        imagen.save(CARPETA / f"{doc_id}_p{i + 1}.jpg", "JPEG", quality=65)
        figuras.append(i + 1)
    return paginas, figuras


def _docx(datos: bytes) -> list[str]:
    with zipfile.ZipFile(BytesIO(datos)) as zf:
        xml = zf.read("word/document.xml").decode("utf-8", errors="ignore")
    xml = re.sub(r"</w:p>", "\n", xml)
    xml = re.sub(r"<w:tab/>", "\t", xml)
    return [_texto_xml(xml)]


def _pptx(datos: bytes) -> list[str]:
    with zipfile.ZipFile(BytesIO(datos)) as zf:
        diapositivas = sorted(
            (n for n in zf.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)),
            key=lambda n: int(re.search(r"\d+", n).group()),
        )
        return [
            "\n".join(_texto_xml(t) for t in re.findall(r"<a:t>(.*?)</a:t>", zf.read(n).decode("utf-8", errors="ignore")))
            for n in diapositivas
        ]


def procesar(nombre: str, mime: str, datos: bytes) -> dict:
    """Extrae el texto (una sola vez por archivo) y devuelve el resumen que usa la extensión."""
    doc_id = hashlib.sha1(datos).hexdigest()[:20]
    if (existente := cargar(doc_id)) is not None:
        return resumen(existente)

    CARPETA.mkdir(parents=True, exist_ok=True)
    tipo = _tipo(nombre, mime, datos)
    figuras: list[int] = []
    if tipo == "pdf":
        paginas, figuras = _pdf(datos, doc_id)
    elif tipo == "docx":
        paginas = _docx(datos)
    elif tipo == "pptx":
        paginas = _pptx(datos)
    else:
        paginas = [datos.decode("utf-8", errors="ignore")]

    doc = {"id": doc_id, "nombre": nombre, "tipo": tipo, "paginas": paginas, "figuras": figuras}
    (CARPETA / f"{doc_id}.json").write_text(json.dumps(doc, ensure_ascii=False))
    return resumen(doc)


def cargar(doc_id: str) -> dict | None:
    if doc_id in _cache:
        return _cache[doc_id]
    ruta = CARPETA / f"{doc_id}.json"
    if not re.fullmatch(r"[0-9a-f]{20}", doc_id or "") or not ruta.exists():
        return None
    if len(_cache) >= MAX_EN_MEMORIA:
        _cache.pop(next(iter(_cache)))
    _cache[doc_id] = json.loads(ruta.read_text())
    return _cache[doc_id]


def resumen(doc: dict) -> dict:
    return {
        "id": doc["id"],
        "nombre": doc["nombre"],
        "tipo": doc["tipo"],
        "paginas": len(doc["paginas"]),
        "caracteres": sum(len(p) for p in doc["paginas"]),
        "figuras": len(doc["figuras"]),
    }


def figuras(doc: dict) -> list[bytes]:
    return [(CARPETA / f"{doc['id']}_p{n}.jpg").read_bytes() for n in doc["figuras"]]


def _normalizar(texto: str) -> str:
    return unicodedata.normalize("NFD", texto.lower()).encode("ascii", "ignore").decode()


def fragmento(doc: dict, pregunta: str, limite: int) -> str:
    """Todo el documento si cabe; si no, la primera página más las páginas más relacionadas con la pregunta."""
    etiqueta = "Diapositiva" if doc["tipo"] == "pptx" else "Página"
    bloques = [f"[{etiqueta} {i + 1}]\n{t.strip()}" for i, t in enumerate(doc["paginas"]) if t.strip()]
    completo = "\n\n".join(bloques)
    if len(completo) <= limite:
        return completo

    claves = set(re.findall(r"[a-z0-9]{4,}", _normalizar(pregunta)))
    puntajes = sorted(
        ((sum(_normalizar(b).count(c) for c in claves), i) for i, b in enumerate(bloques)),
        key=lambda par: (-par[0], par[1]),
    )
    elegidos, usado = set(), 0
    for _, i in [(None, 0), *puntajes]:  # la primera página siempre da contexto (título, enunciado)
        if i in elegidos or usado + len(bloques[i]) > limite:
            continue
        elegidos.add(i)
        usado += len(bloques[i])
    if not elegidos:
        return bloques[0][:limite]
    omitidas = len(bloques) - len(elegidos)
    texto = "\n\n".join(bloques[i] for i in sorted(elegidos))
    return f"{texto}\n\n[Se omitieron {omitidas} {etiqueta.lower()}s menos relacionadas con la pregunta para responder rápido.]"
