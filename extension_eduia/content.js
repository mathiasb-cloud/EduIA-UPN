// Crear el botón flotante
const botonFlotante = document.createElement("div");
botonFlotante.innerHTML = "🎓 EduIA";
botonFlotante.style.cssText = `
  position: fixed;
  bottom: 20px;
  right: 20px;
  background-color: #ff5e14;
  color: white;
  padding: 15px 20px;
  border-radius: 50px;
  cursor: pointer;
  z-index: 10000;
  font-family: Arial, sans-serif;
  font-weight: bold;
  box-shadow: 0 4px 6px rgba(0,0,0,0.3);
`;

// Crear el panel de chat (oculto por defecto)
const panelChat = document.createElement("div");
panelChat.style.cssText = `
  position: fixed;
  bottom: 80px;
  right: 20px;
  width: 350px;
  height: 500px;
  background: white;
  border-radius: 10px;
  box-shadow: 0 10px 20px rgba(0,0,0,0.2);
  z-index: 10000;
  display: none;
  flex-direction: column;
  overflow: hidden;
`;

// Estructura básica del chat
panelChat.innerHTML = `
  <div style="background:#333; color:white; padding:15px; font-weight:bold;">🎓 EduIA-UPN</div>
  <div id="eduia-mensajes" style="flex:1; padding:15px; overflow-y:auto; background:#f9f9f9;"></div>
  <input type="text" id="eduia-input" placeholder="Pregunta sobre esta página..." style="padding:15px; border:none; border-top:1px solid #ddd; outline:none;">
`;

// Agregar elementos a Blackboard
document.body.appendChild(botonFlotante);
document.body.appendChild(panelChat);

// Lógica para minimizar/maximizar
botonFlotante.addEventListener("click", () => {
  if (panelChat.style.display === "none") {
    panelChat.style.display = "flex";
  } else {
    panelChat.style.display = "none";
  }
});

const inputPregunta = document.getElementById("eduia-input");
const contenedorMensajes = document.getElementById("eduia-mensajes");

inputPregunta.addEventListener("keypress", async (e) => {
  if (e.key === "Enter" && inputPregunta.value.trim() !== "") {
    const pregunta = inputPregunta.value;
    inputPregunta.value = "";
    
    contenedorMensajes.innerHTML += `<div style="margin-bottom:10px; color:#ff5e14;"><b>Tú:</b> ${pregunta}</div>`;
    
    const textoPagina = document.body.innerText;
    
    contenedorMensajes.innerHTML += `<div id="eduia-loading" style="margin-bottom:10px; color:#666;"><i>Analizando Blackboard...</i></div>`;
    contenedorMensajes.scrollTop = contenedorMensajes.scrollHeight;

    try {
      const response = await fetch("http://localhost:8000/preguntar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pregunta: pregunta, contexto_pagina: textoPagina })
      });
      
      const data = await response.json();
      document.getElementById("eduia-loading").remove();
      
      // 4. Mostrar respuesta de EduIA
      contenedorMensajes.innerHTML += `<div style="margin-bottom:15px; color:#333; line-height:1.4;"><b>EduIA:</b><br>${data.respuesta.replace(/\n/g, '<br>')}</div>`;
      contenedorMensajes.scrollTop = contenedorMensajes.scrollHeight;
    } catch (error) {
      document.getElementById("eduia-loading").remove();
      contenedorMensajes.innerHTML += `<div style="margin-bottom:10px; color:red;"><b>Error:</b> El servidor Python (api.py) no está encendido.</div>`;
    }
  }
});