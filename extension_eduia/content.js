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