import os
import pdfplumber
from playwright.sync_api import sync_playwright
from google import genai
from dotenv import load_dotenv

load_dotenv()

def leer_archivo_y_responder(pregunta_usuario: str):
    archivo_temp = "temp_scan.pdf"
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(storage_state="auth.json")
        page = context.new_page()

        print("[*] Entrando silenciosamente a Blackboard...")
        page.goto("https://upn.blackboard.com/ultra/institution-page")
        page.locator("[data-analytics-id='base.nav.navigation.courses']").click()
        page.wait_for_load_state("networkidle")
        
        page.locator("a").filter(has_text="TÉCNICAS DE PROGRAM.ORIE. OBJ.").first.click()
        page.wait_for_timeout(5000)
        
        carpeta = page.locator("div").filter(has_text="Recursos").first
        if carpeta.is_visible():
            carpeta.click()
            page.wait_for_timeout(3000)
            
        primer_pdf = page.get_by_role("link").filter(has_text="PDF").first
        
        if not primer_pdf.is_visible():
            browser.close()
            return "[!] No hay ningún archivo PDF visible en la pantalla para escanear."

        print("[*] Archivo detectado. Escaneando al vuelo...")
        with page.expect_download(timeout=10000) as download_info:
            primer_pdf.click()
            if page.locator("iframe").is_visible():
                page.locator("iframe").content_frame.get_by_role("button", name="Descargar").click()
                
        download = download_info.value
        download.save_as(archivo_temp)
        browser.close()

    texto_escaneado = ""
    with pdfplumber.open(archivo_temp) as pdf:
        for pagina in pdf.pages:
            texto_escaneado += (pagina.extract_text() or "") + "\n"
            
    os.remove(archivo_temp)
    print("[*] Escaneo completo. Analizando con EduIA...")

    cliente_gemini = genai.Client()
    prompt = f"""
    Eres EduIA-UPN. Acabo de escanear este documento de la pantalla de mi curso.
    Responde la pregunta del estudiante basándote EXCLUSIVAMENTE en este texto.
    Si pide resolver un examen, guíalo con la teoría, no le des la respuesta final.

    TEXTO ESCANEADO:
    {texto_escaneado[:15000]} # Límite de seguridad

    PREGUNTA DEL ESTUDIANTE:
    {pregunta_usuario}
    """
    
    respuesta = cliente_gemini.models.generate_content(
        model='gemini-3.6-flash',
        contents=prompt
    )
    
    return respuesta.text

if __name__ == "__main__":
    pregunta = "¿De qué trata este documento y qué ejercicios teóricos debo repasar?"
    resultado = leer_archivo_y_responder(pregunta)
    print("\n=== RESPUESTA DE EDUIA-UPN ===")
    print(resultado)