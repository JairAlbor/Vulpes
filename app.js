if (typeof window === 'undefined') {
    // ==========================================================================
    // NODE.JS LOCAL SERVER
    // ==========================================================================
    const http = require('http');
    const fs = require('fs');
    const path = require('path');

    let port = 4000;

    const MIME_TYPES = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.json': 'application/json'
    };

    const server = http.createServer((req, res) => {
        let filePath = req.url === '/' ? '/index.html' : req.url;
        filePath = filePath.split('?')[0].split('#')[0];
        
        const absolutePath = path.join(__dirname, filePath);
        
        if (!absolutePath.startsWith(__dirname)) {
            res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Acceso denegado');
            return;
        }

        fs.readFile(absolutePath, (err, data) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                    res.end('Archivo no encontrado');
                } else {
                    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                    res.end(`Error interno: ${err.code}`);
                }
                return;
            }

            const ext = path.extname(absolutePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';
            
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        });
    });

    function startServer() {
        server.listen(port, () => {
            console.log(`==================================================`);
            console.log(`Servidor de Vulpes iniciado correctamente`);
            console.log(`Servidor corriendo en: http://localhost:${port}`);
            console.log(`Presiona Ctrl+C para apagar el servidor`);
            console.log(`==================================================`);
        });
    }

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`⚠️  El puerto ${port} está ocupado. Intentando con el puerto ${port + 1}...`);
            port++;
            startServer();
        } else {
            console.error('Error del servidor:', err);
        }
    });

    startServer();
} else {
    // ==========================================================================
    // CHATBOT CONTROLLER & GEMINI API INTEGRATION
    // ==========================================================================
    const GEMINI_API_KEY = "AIzaSyBIGlBbKcl9Lv_zwSbmizF50KNVo7g8mag";
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    // Chatbot Context: Official details extracted from colegio.umich.mx
    const SYSTEM_INSTRUCTION = `
Eres el "Asistente Nicolaita", un asesor virtual inteligente para el prestigioso e histórico "Colegio Primitivo y Nacional de San Nicolás de Hidalgo", perteneciente a la Universidad Michoacana de San Nicolás de Hidalgo (UMSNH).
Tu objetivo es responder de manera amable, atenta y precisa las preguntas de los aspirantes, alumnos y padres de familia, basándote estrictamente en los siguientes datos oficiales de la institución:

1. HISTORIA E IDENTIDAD:
- Fundado en 1540 por Don Vasco de Quiroga en Pátzcuaro, y trasladado a Valladolid (Morelia) en 1580. Es el colegio más antiguo de América.
- Conocido como "Cuna Ideológica de la Independencia de México".
- Don Miguel Hidalgo y Costilla fue alumno, catedrático y Regente del Colegio.
- José María Morelos y Pavón fue uno de sus alumnos más célebres.
- El lema del colegio es "Patria, Ciencia y Libertad".
- Autoridades: Rectora de la UMSNH: Dra. Yarabí Ávila González. Regente del Colegio: Dra. Janeth Morales Cortés (Regencia 2022-2026).

2. CONVOCATORIA DE ADMISIÓN NUEVO INGRESO 2026 (BACHILLERATO):
- Registro en línea: Se realiza exclusivamente en el sitio oficial de la UMSNH: www.umich.mx. El trámite es personal y no se aceptan gestores.
- ¡Plazo Ampliado!: El periodo de registro se ha ampliado hasta el 25 de junio de 2026.
- Exámenes de ingreso: Se aplicarán del 30 de junio al 3 de julio de 2026.
- Publicación de resultados: 3 y 6 de julio de 2026.
- Inicio de clases: 10 de agosto de 2026.
- Costos: El costo de la solicitud de ingreso (ficha de examen) es de $1,576.00 MXN. Además, se debe pagar el Curso de Inducción.
- Requisitos:
  * CURP y Acta de nacimiento.
  * Certificado de secundaria o Constancia de estudios de secundaria (debes haber concluido los estudios de secundaria antes del 10 de agosto).
  * Comprobante de domicilio.
  * Identificación con fotografía en PDF o JPG.
  * Número de Seguridad Social (NSS).
  * Correo electrónico y teléfono activos.
- Nota: La asignación de preparatoria se realiza de forma aleatoria sujeta al cupo de las 7 preparatorias de la UMSNH (5 en Morelia y 2 en Uruapan).

3. PLAN DE ESTUDIOS (BACHILLERATO NICOLAITA):
- Sistema: Semestral, con duración de 3 años (6 semestres). No es terminal, sino propedéutico (prepara al alumno para la universidad).
- Tronco Común: Primeros 4 semestres (formación integral básica en ciencias, humanidades y tecnología).
- Áreas Propedéuticas: Se eligen en el 5º y 6º semestre según la carrera universitaria a cursar:
  * Ciencias Económico-Administrativas (Administración, Contabilidad, Economía, etc.).
  * Ciencias Histórico-Sociales (Derecho, Psicología, Historia, Letras, etc.).
  * Ciencias Químico-Biológicas (Medicina, Odontología, Enfermería, Biología, etc.).
  * Ingeniería y Arquitectura (Ingeniería Civil, Computación, Arquitectura, Matemáticas, etc.).

4. TRÁMITES Y SERVICIOS:
- Seguro Facultativo: Afiliación gratuita al servicio médico IMSS otorgada por la UMSNH a alumnos inscritos que no cuenten con otra seguridad social. Se tramita al inscribirse con su NSS.
- Justificantes: Los alumnos pueden solicitar justificantes de inasistencias en caso de enfermedad u otros motivos de fuerza mayor a través de la Secretaría Académica (correo o módulo s-justificantes.html).
- Sistema de Alerta Temprana: Plataforma (planificador.lugh.mx/informacion_reportes) para consulta de alumnos sobre reportes académicos tempranos.
- SIIA (Sistema de Información Académica): www.siia.umich.mx para consulta de calificaciones y órdenes de pago.
- Correo Institucional: Cuenta de Google/Gmail proporcionada a los estudiantes para sus clases.

5. PORTAL DE HORARIOS DE CLASE Y MANUALES:
- Portal Principal de Horarios: https://www.colegio.umich.mx/horarios/horarios.html
- Horarios de Semestres Regulares (Tronco Común y Especialidades):
  * Semestre NON (Agosto/Febrero - 1er, 3er y 5to Semestre):
    Enlace general: https://www.colegio.umich.mx/horarios/semestrenon.html
    (Ejemplos: sección 101, 301, 501AE, etc. se encuentran listados como botones aquí).
  * Semestre PAR (Febrero/Agosto - 2do, 4to y 6to Semestre):
    Enlace general: https://www.colegio.umich.mx/horarios/semestrepar.html
    (Ejemplos: sección 201, 401, 601, etc. se encuentran listados como botones aquí).

- Horarios de Trayectorias Especiales:
  * Trayectorias 3er Semestre (Semestre NON):
    Enlace: https://www.colegio.umich.mx/horarios/trayectorias3non.html
  * Trayectorias 5to Semestre (Semestre NON):
    Enlace: https://www.colegio.umich.mx/horarios/trayectorias5non.html
  * Trayectorias 4to y 6to Semestre (Semestre PAR):
    Enlace: https://www.colegio.umich.mx/horarios/tacad-par.html

- Manuales de Laboratorio (e.g. Química Inorgánica, Química Orgánica):
  Enlace: https://www.colegio.umich.mx/horarios/semestrenon.html
  (Indica al usuario que en este enlace de Semestre NON encontrará botones de color verde para descargar los manuales oficiales en PDF para su respectivo semestre).

- INSTRUCCIONES DE RESPUESTA PARA HORARIOS Y MANUALES:
  1. IMPORTANTE: NO almacenes ni proporciones enlaces directos a archivos PDF individuales (enlaces que terminen en '.pdf'), ya que los nombres de los archivos pueden cambiar en el servidor de la institución. Proporciona SIEMPRE el enlace general a la página correspondiente donde se encuentra el botón para descargar dicho archivo.
  2. Si preguntan por una sección regular (ej. Sección 101): Explica que corresponde al 1er Semestre (Semestre NON) y proporciónales únicamente el enlace general: https://www.colegio.umich.mx/horarios/semestrenon.html donde podrán buscar y pulsar el botón con su sección.
  3. Si preguntan por horarios de trayectorias de 3er o 5to semestre, proporciónales el enlace exacto correspondiente:
     - Trayectorias de 3er Semestre: https://www.colegio.umich.mx/horarios/trayectorias3non.html
     - Trayectorias de 5to Semestre: https://www.colegio.umich.mx/horarios/trayectorias5non.html
  4. Si preguntan por Manuales de Laboratorio, guíalos cordialmente e indícales que pueden descargarlos pulsando los botones de color verde en la página general de horarios del Semestre NON: https://www.colegio.umich.mx/horarios/semestrenon.html
  5. IMPORTANTE: No utilices el formato de enlace de Markdown '[texto](url)'. En su lugar, escribe las URLs completas directamente en tu respuesta (ejemplo: 'https://www.colegio.umich.mx/horarios/semestrenon.html'). La interfaz del chatbot se encargará automáticamente de convertirlas en enlaces clicables estilizados de forma perfecta.

6. DATOS DE CONTACTO:
- Dirección: Av. Madero Poniente 351, Col. Centro, C.P. 58000, Morelia, Michoacán, México.
- Horario de atención: Turno Matutino (7:00 AM - 2:00 PM), Turno Vespertino (2:00 PM - 9:00 PM).
- Correo Académico: sria.acad.cpnsnh@umich.mx
- Clave de Centro de Trabajo (CCT): 16UBH0019C

LINEAMIENTOS DE PERSONALIDAD:
- Sé amable, educado y usa un tono entusiasta que demuestre orgullo Nicolaita.
- Estás diseñado ÚNICAMENTE para contestar preguntas sobre el Colegio Primitivo y Nacional de San Nicolás de Hidalgo y el Bachillerato Nicolaita. Si te preguntan cosas no relacionadas (ej. programar en Python, recetas de cocina, física de nivel superior, chistes extraños), responde con cortesía diciendo que solo estás facultado para proveer información oficial del Colegio y cordialmente redirige la conversación al tema escolar.
- Emplea párrafos breves, viñetas y formato en negritas para que las respuestas sean fáciles de leer en una pantalla pequeña.
`;

    // variable que almacena el historial de la conversación para enviar al API y mantener el contexto de la charla
    let conversationHistory = [];

    // elementos del DOM para la interacción del chatbot (declarados de forma segura)
    let chatToggleBtn, chatbotContainer, chatCloseBtn, chatInput, chatSendBtn, chatLog, chatBody, typingIndicator, quickBtns;

    function initChatbot() {
        chatToggleBtn = document.getElementById("chat-toggle");
        chatbotContainer = document.getElementById("chatbot-container");
        chatCloseBtn = document.getElementById("chat-close");
        chatInput = document.getElementById("chat-input");
        chatSendBtn = document.getElementById("chat-send");
        chatLog = document.getElementById("chat-log");
        chatBody = document.getElementById("chat-body");
        typingIndicator = document.getElementById("typing-indicator");
        quickBtns = document.querySelectorAll(".quick-btn");

        if (!chatToggleBtn || !chatbotContainer) {
            console.warn("No se encontraron los elementos esenciales del chatbot en el DOM. Reintentando...");
            return;
        }

        // Abrir el chatbot al hacer click en el botón flotante
        chatToggleBtn.addEventListener("click", () => {
            chatbotContainer.classList.add("active");
            chatToggleBtn.classList.add("hidden");
            if (chatInput) chatInput.focus();
            scrollToBottom();
        });

        if (chatCloseBtn) {
            chatCloseBtn.addEventListener("click", () => {
                chatbotContainer.classList.remove("active");
                chatToggleBtn.classList.remove("hidden");
            });
        }

        if (chatSendBtn) {
            chatSendBtn.addEventListener("click", handleUserSend);
        }

        if (chatInput) {
            chatInput.addEventListener("keypress", (e) => {
                if (e.key === "Enter") {
                    handleUserSend();
                }
            });
        }

        if (quickBtns) {
            quickBtns.forEach(btn => {
                btn.addEventListener("click", () => {
                    const question = btn.getAttribute("data-question");
                    if (question) {
                        sendQuery(question);
                    }
                });
            });
        }

        // Auto-open chatbot after a small delay for smooth entry animation
        setTimeout(() => {
            chatbotContainer.classList.add("active");
            chatToggleBtn.classList.add("hidden");
            scrollToBottom();
        }, 300);
    }

    // Inicialización robusta dependiente del estado del DOM
    if (document.readyState === "loading") {
        window.addEventListener("DOMContentLoaded", initChatbot);
    } else {
        initChatbot();
    }

    // ==========================================================================
    // FUNCIONES PRINCIPALES DEL CHATBOT: manejo de mensajes, integración con Gemini API, formateo de respuestas, etc.
    // ==========================================================================

    function handleUserSend() {
        if (!chatInput) return;
        const text = chatInput.value.trim();
        if (!text) return;
        
        chatInput.value = "";
        sendQuery(text);
    }

    // Function to send user query
    async function sendQuery(queryText) {
        // 1. Render user message in UI
        appendMessage(queryText, "user");
        scrollToBottom();
        
        // 2. Add message to conversation history
        conversationHistory.push({
            role: "user",
            parts: [{ text: queryText }]
        });
        
        // 3. Show typing indicator
        showTyping(true);
        scrollToBottom();
        
        try {
            // 4. Perform API fetch to Gemini 2.5 Flash
            const response = await fetch(GEMINI_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: conversationHistory,
                    systemInstruction: {
                        parts: [{ text: SYSTEM_INSTRUCTION }]
                    },
                    generationConfig: {
                        temperature: 0.4,
                        topP: 0.95,
                        maxOutputTokens: 800
                    }
                })
            });
            
            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // 5. Hide typing indicator
            showTyping(false);
            
            // 6. Extract and format response
            const botResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text 
                || "Lo siento, tuve un inconveniente al procesar tu solicitud. Por favor intenta de nuevo.";
                
            // 7. Append bot message in UI and save in history
            appendMessage(botResponseText, "bot");
            conversationHistory.push({
                role: "model",
                parts: [{ text: botResponseText }]
            });
            
            scrollToBottom();
            
        } catch (error) {
            console.error("Chat Error:", error);
            showTyping(false);
            appendMessage("Ocurrió un error de conexión. Asegúrate de tener conexión a Internet e inténtalo de nuevo.", "bot");
            scrollToBottom();
        }
    }

    // Helper to append message bubble to UI
    function appendMessage(text, sender) {
        if (!chatLog) return;
        const messageRow = document.createElement("div");
        messageRow.className = `message-row ${sender === "user" ? "user-row" : "bot-row"}`;
        
        let htmlContent = "";
        
        if (sender === "user") {
            htmlContent = `
                <div class="message-bubble user-bubble">
                    <p>${escapeHTML(text)}</p>
                </div>
            `;
        } else {
            htmlContent = `
                <div class="bot-avatar" title="Asistente de San Nicolás">
                    <img src="images/zorroicon.png" alt="Zorro Icon">
                </div>
                <div class="message-bubble bot-bubble">
                    ${formatMarkdown(text)}
                </div>
            `;
        }
        
        messageRow.innerHTML = htmlContent;
        chatLog.appendChild(messageRow);
    }

    // Toggle typing state
    function showTyping(show) {
        if (!typingIndicator) return;
        if (show) {
            typingIndicator.classList.remove("hidden");
        } else {
            typingIndicator.classList.add("hidden");
        }
    }

    // Auto scroll chat to bottom
    function scrollToBottom() {
        if (chatBody) {
            chatBody.scrollTop = chatBody.scrollHeight;
        }
    }

    // ==========================================================================
    // UTILITIES: funciones para formateo de texto, escape de HTML, etc.
    // ==========================================================================

    function escapeHTML(str) {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatMarkdown(text) {
        // 1. Escape basic HTML tags to prevent injection (excluding special structures)
        let formatted = escapeHTML(text);
        
        // 2. Bold Formatting: **text** -> <strong>text</strong>
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        
        // 3. Bullet list formatting: lines starting with "*" or "-" -> • item
        formatted = formatted.replace(/^(?:\*|-)\s+(.*?)$/gm, "• $1");
        
        // 4. Line Breaks: \n -> <br>
        formatted = formatted.replace(/\n/g, "<br>");
        
        // 5. Autolink email: detect email pattern and put mailto tag
        formatted = formatted.replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi, '<a href="mailto:$1" class="text-gold">$1</a>');
        
        // 6. Autolink URL: detect www. or http:// and make standard clickable links
        formatted = formatted.replace(/(https?:\/\/[^\s<]+)/gi, '<a href="$1" target="_blank" class="text-gold">$1 <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 0.7rem;"></i></a>');
        formatted = formatted.replace(/(^|[^\/])(www\.[^\s<]+)/gi, '$1<a href="https://$2" target="_blank" class="text-gold">$2 <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 0.7rem;"></i></a>');

        return formatted;
    }
}
