import chromadb
from dotenv import load_dotenv
from google import genai

load_dotenv()

def consultar_eduia(pregunta: str) -> str:
    print(f"[*] Buscando contexto en ChromaDB para: '{pregunta}'")
    
    cliente_chroma = chromadb.PersistentClient(path="./chroma_db")
    coleccion = cliente_chroma.get_collection(name="reglamentos_upn")
    
    resultados = coleccion.query(
        query_texts=[pregunta],
        n_results=3 
    )
    
    contexto_recuperado = "\n---\n".join(resultados['documents'][0])
    
    if not contexto_recuperado.strip():
        return "No encontré información relevante en los documentos procesados."

    print("[*] Contexto recuperado. Generando respuesta con Gemini...")
    
    cliente_gemini = genai.Client()
    
    prompt = f"""
    Eres EduIA-UPN, un asistente académico inteligente. 
    Responde la pregunta del usuario utilizando ÚNICAMENTE el contexto proporcionado abajo. 
    Si la respuesta no está en el contexto, di claramente "No tengo información sobre eso en los documentos actuales." no inventes datos.

    CONTEXTO EXTRAÍDO:
    {contexto_recuperado}

    PREGUNTA DEL USUARIO: 
    {pregunta}
    """
    
    try:
        respuesta = cliente_gemini.models.generate_content(
            model='gemini-3.6-flash',
            contents=prompt
        )
        return respuesta.text
    except Exception as e:
        return f"[!] Error conectando con Gemini: {e}"

if __name__ == "__main__":
    pregunta_prueba = "¿Qué alternativas contienen magnitudes dinámicas en un arnés ortopédico?"
    
    respuesta_final = consultar_eduia(pregunta_prueba)
    
    print("\n=== RESPUESTA DE EDUIA-UPN ===")
    print(respuesta_final)