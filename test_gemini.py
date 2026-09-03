import os
import pdfplumber
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Carga las variables del archivo .env
load_dotenv()

def extraer_texto_pdf(ruta_archivo: str) -> str:
    """Extrae y retorna el texto de un archivo PDF usando pdfplumber."""
    texto_completo = []
    try:
        with pdfplumber.open(ruta_archivo) as pdf:
            for pagina in pdf.pages:
                texto_extraido = pagina.extract_text()
                if texto_extraido:
                    texto_completo.append(texto_extraido)
        return "\n".join(texto_completo)
    except FileNotFoundError:
        print(f"[!] Error: No se encontró el archivo '{ruta_archivo}'.")
        return ""
    except Exception as e:
        print(f"[!] Error leyendo el PDF: {e}")
        return ""

def consultar_fechas_gemini(texto_silabo: str) -> str:
    """Envía el texto a Gemini para extraer y estructurar las fechas de evaluación."""
    # El cliente asume automáticamente que GEMINI_API_KEY está en el entorno
    client = genai.Client()

    prompt = f"""
    Actúa como un asistente académico. Analiza el siguiente texto de un sílabo universitario y extrae las fechas o semanas exactas de las evaluaciones principales (T1, T2, Parcial, Final).
    Devuelve únicamente un JSON válido con esta estructura exacta:
    {{
        "evaluaciones": [
            {{"tipo": "T1", "fecha_o_semana": "..."}},
            {{"tipo": "Parcial", "fecha_o_semana": "..."}}
        ]
    }}

    Texto del sílabo:
    {texto_silabo}
    """

    try:
        # Modelo actualizado a la versión vigente
        response = client.models.generate_content(
            model='gemini-3.6-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1 
            )
        )
        return response.text
    except Exception as e:
        return f"[!] Error en la API de Gemini: {e}"

if __name__ == "__main__":
    ruta_pdf = "silabo_prueba.pdf"

    print(f"[*] Procesando '{ruta_pdf}'...")
    texto_base = extraer_texto_pdf(ruta_pdf)

    if not texto_base.strip():
        print("[!] Proceso abortado. Verifica que el PDF contenga texto seleccionable.")
    else:
        print("[*] PDF leído correctamente. Extrayendo fechas con Gemini...")
        resultado = consultar_fechas_gemini(texto_base)
        
        print("\nESTRUCTURA DE EVALUACIONES")
        print(resultado)