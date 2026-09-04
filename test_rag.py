import chromadb
import pdfplumber

def extraer_texto(ruta_pdf: str) -> str:
    texto = ""
    try:
        with pdfplumber.open(ruta_pdf) as pdf:
            for pagina in pdf.pages:
                extraido = pagina.extract_text()
                if extraido:
                    texto += extraido + "\n"
    except FileNotFoundError:
        print(f"[!] Error: No se encontró '{ruta_pdf}'.")
    return texto

def dividir_texto(texto: str, tamano_chunk=1000, superposicion=200) -> list:
    """Divide el texto en fragmentos con un poco de superposición para no perder contexto."""
    chunks = []
    for i in range(0, len(texto), tamano_chunk - superposicion):
        chunks.append(texto[i:i + tamano_chunk])
    return chunks

def crear_coleccion_rag(ruta_pdf: str):
    print("[*] Extrayendo texto del reglamento...")
    texto_completo = extraer_texto(ruta_pdf)
    if not texto_completo:
        return None
        
    chunks = dividir_texto(texto_completo)
    print(f"[*] Texto dividido en {len(chunks)} fragmentos. Inicializando ChromaDB...")
    
    cliente = chromadb.PersistentClient(path="./chroma_db")
    
    try:
        cliente.delete_collection(name="reglamentos_upn")
    except Exception:
        pass
        
    coleccion = cliente.create_collection(name="reglamentos_upn")

    print("[*] Generando embeddings y guardando en ChromaDB (esto puede tomar unos segundos)...")
    coleccion.add(
        documents=chunks,
        metadatas=[{"origen": ruta_pdf, "chunk": i} for i in range(len(chunks))],
        ids=[f"chunk_{i}" for i in range(len(chunks))]
    )
    print("[*] ¡Base de datos vectorial creada exitosamente!")
    return coleccion

if __name__ == "__main__":
    ruta_reglamento = "reglamento_prueba.pdf" 
    
    coleccion = crear_coleccion_rag(ruta_reglamento)
    
    if coleccion:
        pregunta = "¿Cuáles son los requisitos para la titulación o las faltas disciplinarias?"
        print(f"\n[*] Simulando consulta RAG: '{pregunta}'")
        
        resultados = coleccion.query(
            query_texts=[pregunta],
            n_results=2 
        )
        
        print("\n=== CONTEXTO RECUPERADO PARA GEMINI ===")
        for i, doc in enumerate(resultados['documents'][0]):
            print(f"\n--- Fragmento {i+1} ---")
            print(f"{doc[:300]}...")