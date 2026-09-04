from playwright.sync_api import sync_playwright

def generar_archivo_sesion():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()
        
        print("[*] Abriendo portal de la universidad...")
        page.goto("https://upn.blackboard.com/")
        
        print("\n" + "="*50)
        print("ACCIÓN REQUERIDA EN EL NAVEGADOR")
        print("1. Inicia sesión con tu correo y contraseña.")
        print("2. Aprueba el acceso en Microsoft Authenticator o SMS.")
        print("3. Asegúrate de estar en el panel principal donde ves tus cursos.")
        print("="*50 + "\n")
        
        input("Presiona ENTER aquí en la terminal SOLAMENTE cuando ya veas tus cursos en el navegador...")
        
        context.storage_state(path="auth.json")
        print("[*] ¡Éxito! Archivo 'auth.json' generado. Sesión guardada.")
        browser.close()

if __name__ == "__main__":
    generar_archivo_sesion()