from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from PIL import Image
import io
import base64
import os
import json
import time
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from twilio.rest import Client
from dotenv import load_dotenv

load_dotenv()
app = FastAPI()

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

planificador = BackgroundScheduler()
planificador.start()

TWILIO_SID = os.getenv("TWILIO_SID", "ACc4121250189c98cf711547889b5a8ac4")
TWILIO_TOKEN = os.getenv("TWILIO_TOKEN", "4b8387be759aac32cd5fea9c3be7a7fd")
TWILIO_NUMERO = "whatsapp:+51926600376"
MI_NUMERO = "whatsapp:+51999888777"

def enviar_whatsapp(tarea_texto: str):
    cliente_tw = Client(TWILIO_SID, TWILIO_TOKEN)
    cliente_tw.messages.create(
        from_=TWILIO_NUMERO,
        body=f"🎓 *EduIA-UPN Alerta:*\n{tarea_texto}",
        to=MI_NUMERO
    )

class Consulta(BaseModel):
    pregunta: str
    contexto_pagina: str
    imagen_base64: str = None

def clasificar_intencion(pregunta: str, cliente) -> bool:
    prompt_clasificador = f"""
    Analiza esta petición de un estudiante universitario.
    ¿Está pidiendo que le resuelvan el trabajo completo, le den el código fuente final, o le redacten un informe clínico/ensayo?
    Responde ÚNICAMENTE con "BLOQUEAR" si busca la solución fácil, o "PERMITIR" si busca orientación, teoría o depuración.
    
    Petición: {pregunta}
    """
    try:
        respuesta = cliente.models.generate_content(
            model='gemini-3.6-flash',
            contents=prompt_clasificador
        )
        return "BLOQUEAR" in respuesta.text.strip().upper()
    except:
        return False

@app.post("/preguntar")
def responder_duda(consulta: Consulta):
    cliente = genai.Client()
    
    prompt_detector = f"""
    Analiza esta petición: "{consulta.pregunta}"
    ¿El usuario está pidiendo que se le recuerde algo o se le envíe un aviso a futuro?
    Si es así, extrae la fecha/hora y el motivo. Hoy es {datetime.now().strftime("%Y-%m-%d %H:%M")}.
    Responde ÚNICAMENTE en este formato JSON si es un recordatorio, o "NO" si es una pregunta normal:
    {{"fecha_hora": "YYYY-MM-DD HH:MM:SS", "mensaje": "Texto del recordatorio"}}
    """
    
    try:
        analisis_recordatorio = cliente.models.generate_content(
            model='gemini-3.6-flash',
            contents=prompt_detector
        ).text.strip()
        
        if analisis_recordatorio != "NO":
            datos = json.loads(analisis_recordatorio)
            fecha_obj = datetime.strptime(datos["fecha_hora"], "%Y-%m-%d %H:%M:%S")
            
            planificador.add_job(
                enviar_whatsapp, 
                'date', 
                run_date=fecha_obj, 
                args=[datos["mensaje"]]
            )
            return {"respuesta": f"✅ Listo. Te enviaré un WhatsApp el **{datos['fecha_hora']}** para recordarte: *{datos['mensaje']}*."}
            
    except Exception:
        pass

    es_solucion_directa = clasificar_intencion(consulta.pregunta, cliente)
    
    if es_solucion_directa:
        prompt_maestro = f"""
        Eres EduIA-UPN, un mentor académico estricto. El estudiante intentó que le resuelvas su tarea: "{consulta.pregunta}"
        
        NO resuelvas el ejercicio ni le des la respuesta final. Aplica el método socrático:
        1. Señala amablemente que tu rol es guiar su lógica, no hacer el trabajo.
        2. Hazle una pregunta técnica clave. Si pide código, oblígalo a pensar en la validación de entradas con Scanner o el manejo de excepciones. Si pide un plan de tratamiento en terapia manual, pregúntale primero por los hallazgos en su evaluación postural o los rangos de movimiento activo-asistido.
        
        Texto en pantalla: {consulta.contexto_pagina[:2000]}
        """
    else:
        prompt_maestro = f"""
        Eres EduIA-UPN. Analiza la imagen y el texto de la pantalla.
        Responde su duda guiándolo paso a paso. Mantén un tono académico, claro y motivador.
        
        Texto en pantalla: {consulta.contexto_pagina[:2000]}
        Pregunta: {consulta.pregunta}
        """
        
    contenidos = [prompt_maestro]
    
    if consulta.imagen_base64:
        formato, imgstr = consulta.imagen_base64.split(';base64,')
        imagen_bytes = base64.b64decode(imgstr)
        imagen_pil = Image.open(io.BytesIO(imagen_bytes))
        contenidos.insert(0, imagen_pil) 

    intentos_maximos = 3
    for intento in range(intentos_maximos):
        try:
            respuesta = cliente.models.generate_content(
                model='gemini-3.6-flash',
                contents=contenidos
            )
            return {"respuesta": respuesta.text}
            
        except Exception as e:
            error_str = str(e)
            if "503" in error_str and intento < intentos_maximos - 1:
                time.sleep(2)
                continue
                
            return {"respuesta": f"[!] El sistema está procesando demasiadas solicitudes en este momento. Por favor, intenta de nuevo en unos segundos."}