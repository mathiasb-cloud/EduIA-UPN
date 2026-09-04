import os
import re
from playwright.sync_api import sync_playwright

def rastreador_avanzado():
    carpeta_docs = "documentos_blackboard"
    os.makedirs(carpeta_docs, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(storage_state="auth.json")
        page = context.new_page()

        print("[*] Iniciando Rastreador en Blackboard...")
        page.goto("https://upn.blackboard.com/ultra/institution-page")
        page.wait_for_load_state("networkidle")
        
        print("[*] Navegando a Cursos...")
        page.locator("[data-analytics-id='base.nav.navigation.courses']").click()
        page.wait_for_load_state("networkidle")
        
        print("[*] Entrando al curso de Programación...")
        page.locator("a").filter(has_text="TÉCNICAS DE PROGRAM.ORIE. OBJ.").first.click()
        
        # CRÍTICO: Pausa para dejar que el panel del curso cargue
        page.wait_for_timeout(5000)
        
        print("[*] Abriendo carpeta de recursos...")
        # Usamos el Regex exacto que te funcionó en la grabación
        carpeta = page.locator("div").filter(has_text=re.compile(r"^Recursos para la experiencia de aprendizaje$")).first
        
        if carpeta.is_visible():
            carpeta.click()
            print("[*] Desplegando contenido...")
            # CRÍTICO: Pausa para la animación del menú desplegable
            page.wait_for_timeout(3000) 
        else:
            print("[!] La carpeta no está visible. Es posible que ya esté abierta.")
        
        patron_formatos = re.compile(r"(PDF|Word|Excel|PowerPoint|\.pdf|\.docx?|\.xlsx?)", re.IGNORECASE)
        enlaces_crudos = page.get_by_role("link").filter(has_text=patron_formatos).all()
        
        print(f"\n[*] Detectados {len(enlaces_crudos)} elementos potenciales. Filtrando...")
        
        enlaces_validos = []
        for enlace in enlaces_crudos:
            texto_enlace = enlace.inner_text().replace('\n', ' ').strip()
            if texto_enlace and not texto_enlace.lower() in ["descargar", "ayuda", "cerrar"]:
                print(f"  -> Archivo verificado: {texto_enlace}")
                enlaces_validos.append(enlace)

        print("\n[*] Iniciando descargas...")
        for i, enlace in enumerate(enlaces_validos):
            try:
                with page.expect_download(timeout=10000) as download_info:
                    enlace.click()
                    if page.locator("iframe").is_visible():
                        page.locator("iframe").content_frame.get_by_role("button", name="Descargar").click()
                
                download = download_info.value
                ruta = os.path.join(carpeta_docs, download.suggested_filename)
                download.save_as(ruta)
                print(f"  [+] Guardado exitosamente: {download.suggested_filename}")
                
                page.keyboard.press("Escape") 
                page.wait_for_timeout(1000)
            except Exception as e:
                print(f"  [-] Omitiendo el elemento {i+1} (No era descargable).")
                
        browser.close()

if __name__ == "__main__":
    rastreador_avanzado()