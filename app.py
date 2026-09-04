import streamlit as st
import escaner_dinamico
from google import genai
import os

st.set_page_config(page_title="EduIA-UPN", page_icon="🎓")
st.title("🎓 EduIA-UPN")
st.caption("Tu mentor académico autónomo.")

modo = st.radio(
    "¿Qué haremos hoy?",
    ["Escanear Blackboard", "Generar Simulacro"]
)

if "mensajes" not in st.session_state:
    st.session_state.mensajes = []

for mensaje in st.session_state.mensajes:
    with st.chat_message(mensaje["rol"]):
        st.markdown(mensaje["contenido"])

pregunta = st.chat_input("Escribe tu consulta o el tema a repasar...")

if pregunta:
    with st.chat_message("user"):
        st.markdown(pregunta)
    st.session_state.mensajes.append({"rol": "user", "contenido": pregunta})

    with st.chat_message("assistant"):
        with st.spinner("Trabajando en segundo plano..."):
            if modo == "Escanear Blackboard":
                # Llama a Playwright para leer la pantalla en tiempo real
                respuesta = escaner_dinamico.leer_archivo_y_responder(pregunta)
            
            elif modo == "Generar Simulacro":
                # Llama a Gemini directamente para crear una prueba
                cliente = genai.Client()
                prompt_simulacro = f"""
                Actúa como un profesor universitario riguroso. El estudiante solicita un simulacro sobre el siguiente tema: {pregunta}.
                
                Instrucciones:
                1. Genera 3 preguntas teóricas de opción múltiple.
                2. Plantea 1 caso práctico o problema aplicado.
                3. NO proporciones las respuestas correctas. Obliga al estudiante a responderte en el chat primero.
                4. Usa un tono académico, retador y profesional.
                """
                
                try:
                    resp = cliente.models.generate_content(
                        model='gemini-3.6-flash',
                        contents=prompt_simulacro
                    )
                    respuesta = resp.text
                except Exception as e:
                    respuesta = f"[!] Error conectando con la IA: {e}"
            
            st.markdown(respuesta)
    
    st.session_state.mensajes.append({"rol": "assistant", "contenido": respuesta})