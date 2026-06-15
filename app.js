if (typeof window === 'undefined') {
    // ==========================================================================
    // NODE.JS LOCAL SERVER
    // ==========================================================================
    const http    = require('http');
    const fs      = require('fs');
    const path    = require('path');
    const crawler = require('./crawler');   // ← Módulo de scraping

    let port = process.env.PORT || 4000;

    const MIME_TYPES = {
        '.html': 'text/html; charset=utf-8',
        '.css':  'text/css; charset=utf-8',
        '.js':   'application/javascript; charset=utf-8',
        '.png':  'image/png',
        '.jpg':  'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif':  'image/gif',
        '.svg':  'image/svg+xml',
        '.ico':  'image/x-icon',
        '.json': 'application/json'
    };

    const server = http.createServer((req, res) => {

        // ── API: devuelve el cache al chatbot del navegador ────────────────────
        if (req.url === '/api/contexto' && req.method === 'GET') {
            const cache = crawler.leerCache() || Object.assign(
                { ultimaActualizacion: null, urlsSitio: [] },
                crawler.DATOS_ESTATICOS
            );
            res.writeHead(200, {
                'Content-Type':  'application/json; charset=utf-8',
                'Cache-Control': 'no-cache'
            });
            res.end(JSON.stringify(cache));
            return;
        }

        // ── Servir archivos estáticos ──────────────────────────────────────────
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
            const ext         = path.extname(absolutePath).toLowerCase();
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

    // ── Crawler: crear cache inicial y programar actualizaciones ──────────────
    const DIAS_ENTRE_ACTUALIZACIONES  = 7;
    const MS_ENTRE_ACTUALIZACIONES    = DIAS_ENTRE_ACTUALIZACIONES * 24 * 60 * 60 * 1000;

    // Crear cache con datos estáticos si aún no existe ningún archivo
    crawler.inicializarCacheEstatico();

    // Al arrancar: actualizar si el cache tiene más de N días o no existe
    (async () => {
        if (crawler.cacheEsViejo(DIAS_ENTRE_ACTUALIZACIONES)) {
            console.log(`\n📅 Cache desactualizado (>${DIAS_ENTRE_ACTUALIZACIONES} días). Iniciando recorrido del sitio en segundo plano…`);
            crawler.actualizarCache().catch(err =>
                console.error('❌ Error en el crawler:', err.message)
            );
        } else {
            const c    = crawler.leerCache();
            const n    = c && c.urlsSitio ? c.urlsSitio.length : 0;
            const fecha = c && c.ultimaActualizacion
                ? new Date(c.ultimaActualizacion).toLocaleString('es-MX')
                : 'desconocida';
            console.log(`\n✅ Cache vigente (${fecha}). Páginas indexadas: ${n}. No se necesita recorrer el sitio.`);
        }
    })();

    // Actualización automática cada 7 días
    setInterval(() => {
        console.log('\n🔄 Actualización semanal automática del cache. Iniciando crawler…');
        crawler.actualizarCache().catch(err =>
            console.error('❌ Error en el crawler:', err.message)
        );
    }, MS_ENTRE_ACTUALIZACIONES);

} else {
    // ==========================================================================
    // CHATBOT CONTROLLER & GEMINI API INTEGRATION
    // ==========================================================================
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    // Contexto dinámico cargado desde /api/contexto
    let contextoCache = null;

    // Normalización de texto (eliminar acentos y diacríticos)
    function normalizarTexto(texto) {
        return (texto || '')
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }

    // Validación de temas fuera de contexto
    const TEMAS_FUERA = ['receta', 'clima', 'futbol', 'politica', 'chiste', 'poema'];
    function esFueraDeContexto(query) {
        const queryNormalizada = normalizarTexto(query);
        return TEMAS_FUERA.some(t => queryNormalizada.includes(t));
    }

    // Búsqueda de páginas relevantes por palabras clave
    function buscarPaginasRelevantes(query, urlsSitio, topN = 5) {
        const queryNormalizada = normalizarTexto(query);
        const palabras = queryNormalizada.split(/\s+/).filter(w => w.trim().length > 1);
        if (palabras.length === 0) return urlsSitio.slice(0, topN);

        return urlsSitio
            .map(p => {
                const texto = normalizarTexto((p.titulo || '') + ' ' + (p.contenido || ''));
                const score = palabras.filter(w => texto.includes(w)).length;
                return { ...p, score };
            })
            .filter(p => p.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, topN);
    }

    // ── Instrucción base (datos curados, siempre presentes) ───────────────────
    const BASE_INSTRUCTION = `
Eres el "Asistente Nicolaita", un asesor virtual inteligente para el prestigioso e histórico "Colegio Primitivo y Nacional de San Nicolás de Hidalgo", perteneciente a la Universidad Michoacana de San Nicolás de Hidalgo (UMSNH).
Tu objetivo es responder de manera amable, atenta y precisa las preguntas de los aspirantes, alumnos y padres de familia, basándote en los datos oficiales de la institución y en el índice actualizado del sitio web que se adjunta más abajo.

1. HISTORIA E IDENTIDAD:
- Fundado en 1540 por Don Vasco de Quiroga en Pátzcuaro, y trasladado a Valladolid (Morelia) en 1580. Es el colegio más antiguo de América.
- Conocido como 'Cuna Ideológica de la Independencia de México'.
- Don Miguel Hidalgo y Costilla fue alumno, catedrático y Regente del Colegio.
- José María Morelos y Pavón fue uno de sus alumnos más célebres.
- El lema del colegio es 'Patria, Ciencia y Libertad'.
- Autoridades: Rectora de la UMSNH: Dra. Yarabí Ávila González. Regente del Colegio: Dra. Janeth Morales Cortés (Regencia 2022-2026).

2. CONVOCATORIA DE ADMISIÓN NUEVO INGRESO 2026 (BACHILLERATO):
- Registro en línea: exclusivamente en www.umich.mx. El trámite es personal y no se aceptan gestores.
- Plazo ampliado hasta el 25 de junio de 2026.
- Exámenes de ingreso: del 30 de junio al 3 de julio de 2026.
- Publicación de resultados: 3 y 6 de julio de 2026.
- Inicio de clases: 10 de agosto de 2026.
- Costo de la ficha de examen: $1,576.00 MXN. Además se paga el Curso de Inducción.
- Requisitos: CURP, Acta de nacimiento, Certificado de secundaria, Comprobante de domicilio, Identificación con foto (PDF/JPG), NSS, Correo electrónico y teléfono activos.
- La asignación de preparatoria es aleatoria sujeta al cupo de las 7 preparatorias de la UMSNH.

3. PLAN DE ESTUDIOS (BACHILLERATO NICOLAITA):
- Sistema semestral, 3 años (6 semestres), propedéutico (no terminal).
- Tronco Común: 1er a 4to semestre.
- Áreas Propedéuticas (5to y 6to semestre): Económico-Administrativas, Histórico-Sociales, Químico-Biológicas, Ingeniería y Arquitectura.

4. TRÁMITES Y SERVICIOS:
- Seguro Facultativo IMSS: gratuito para alumnos inscritos sin otra seguridad social. Se tramita con el NSS al inscribirse.
- Justificantes: se solicitan a través de la Secretaría Académica (correo o módulo s-justificantes.html).
- Sistema de Alerta Temprana: planificador.lugh.mx/informacion_reportes
- SIIA (calificaciones y órdenes de pago): www.siia.umich.mx
- Correo Institucional: cuenta Gmail proporcionada a los estudiantes para sus clases.

5. PORTAL DE HORARIOS DE CLASE Y MANUALES:
- Portal Principal de Horarios: https://www.colegio.umich.mx/horarios/horarios.html
- Semestre NON (1er, 3er y 5to): https://www.colegio.umich.mx/horarios/semestrenon.html
- Semestre PAR (2do, 4to y 6to): https://www.colegio.umich.mx/horarios/semestrepar.html
- Trayectorias 3er Semestre NON: https://www.colegio.umich.mx/horarios/trayectorias3non.html
- Trayectorias 5to Semestre NON: https://www.colegio.umich.mx/horarios/trayectorias5non.html
- Trayectorias PAR (4to y 6to): https://www.colegio.umich.mx/horarios/tacad-par.html
- Manuales de Laboratorio: en la página de Semestre NON (botones verdes para PDF).

INSTRUCCIONES PARA HORARIOS:
1. NUNCA proporciones enlaces directos a archivos PDF (que terminen en .pdf). Siempre da la página donde está el botón.
2. Sección con centenas impares (101, 301, 501...): Semestre NON → https://www.colegio.umich.mx/horarios/semestrenon.html
3. Sección con centenas pares (201, 401, 601...): Semestre PAR → https://www.colegio.umich.mx/horarios/semestrepar.html
4. Trayectorias 3er semestre → https://www.colegio.umich.mx/horarios/trayectorias3non.html
5. Trayectorias 5to semestre → https://www.colegio.umich.mx/horarios/trayectorias5non.html
6. NUNCA uses el formato Markdown '[texto](url)'. Escribe siempre las URLs completas directamente en el texto.

6. DATOS DE CONTACTO:
- Dirección: Av. Madero Poniente 351, Col. Centro, C.P. 58000, Morelia, Michoacán, México.
- Horario: Matutino 7:00 AM – 2:00 PM | Vespertino 2:00 PM – 9:00 PM.
- Correo Académico: sria.acad.cpnsnh@umich.mx
- CCT: 16UBH0019C

LINEAMIENTOS DE PERSONALIDAD:
- Sé amable, educado y usa un tono entusiasta que demuestre orgullo Nicolaita.
- Solo responde preguntas sobre el Colegio de San Nicolás y el sitio web oficial. Si te preguntan cosas no relacionadas, redirige cordialmente al tema escolar.
- Usa párrafos breves, viñetas y negritas para facilitar la lectura en pantallas pequeñas.
- Si el usuario pregunta sobre algo que está en el índice del sitio web (sección 7 más abajo), proporciona la URL directamente para que pueda acceder a la información.
`;

    // ── Cargar contexto dinámico desde el servidor ─────────────────────────────
    async function fetchContexto() {
        try {
            const res = await fetch('/api/contexto');
            if (res.ok) {
                contextoCache = await res.json();
                const n = contextoCache.urlsSitio ? contextoCache.urlsSitio.length : 0;
                console.log('[Chatbot] Contexto del sitio cargado: ' + n + ' páginas indexadas.');
            }
        } catch (e) {
            console.warn('[Chatbot] No se pudo cargar el contexto dinámico. Usando instrucción base.', e);
        }
    }

    // ── Construir SYSTEM_INSTRUCTION combinando base + índice dinámico ─────────
    function buildSystemInstruction(queryText) {
        if (!contextoCache || !contextoCache.urlsSitio || contextoCache.urlsSitio.length === 0) {
            return BASE_INSTRUCTION;
        }

        const fecha = contextoCache.ultimaActualizacion
            ? new Date(contextoCache.ultimaActualizacion).toLocaleDateString('es-MX')
            : 'desconocida';

        let extra = '\n\n7. ÍNDICE ACTUALIZADO DEL SITIO OFICIAL (actualización: ' + fecha + ')\n\n';
        extra += 'Utiliza el siguiente índice para responder preguntas específicas sobre cualquier sección del sitio web del colegio:\n\n';

        let paginas = [];
        if (queryText) {
            paginas = buscarPaginasRelevantes(queryText, contextoCache.urlsSitio, 5);
        }
        if (paginas.length === 0) {
            paginas = contextoCache.urlsSitio.slice(0, 5);
        }

        for (let i = 0; i < paginas.length; i++) {
            const p = paginas[i];
            if (!p.titulo && !p.descripcion && !p.contenido) continue;
            extra += '### ' + (p.titulo || 'Página del Colegio') + '\n';
            extra += 'URL: ' + p.url + '\n';
            if (p.descripcion) extra += 'Descripción: ' + p.descripcion + '\n';
            if (p.contenido)   extra += 'Contenido: '   + p.contenido.slice(0, 400) + '\n';
            extra += '\n';
        }

        return BASE_INSTRUCTION + extra;
    }

    // Variable que almacena el historial de la conversación
    let conversationHistory = [];

    // Elementos del DOM para la interacción del chatbot
    let chatToggleBtn, chatbotContainer, chatCloseBtn, chatInput, chatSendBtn, chatLog, chatBody, typingIndicator, quickBtns;

    async function initChatbot() {
        // Cargar el índice del sitio desde el servidor
        await fetchContexto();

        chatToggleBtn    = document.getElementById('chat-toggle');
        chatbotContainer = document.getElementById('chatbot-container');
        chatCloseBtn     = document.getElementById('chat-close');
        chatInput        = document.getElementById('chat-input');
        chatSendBtn      = document.getElementById('chat-send');
        chatLog          = document.getElementById('chat-log');
        chatBody         = document.getElementById('chat-body');
        typingIndicator  = document.getElementById('typing-indicator');
        quickBtns        = document.querySelectorAll('.quick-btn');

        if (!chatToggleBtn || !chatbotContainer) {
            console.warn('No se encontraron los elementos esenciales del chatbot en el DOM. Reintentando...');
            return;
        }

        chatToggleBtn.addEventListener('click', () => {
            chatbotContainer.classList.add('active');
            chatToggleBtn.classList.add('hidden');
            if (chatInput) chatInput.focus();
            scrollToBottom();
        });

        if (chatCloseBtn) {
            chatCloseBtn.addEventListener('click', () => {
                chatbotContainer.classList.remove('active');
                chatToggleBtn.classList.remove('hidden');
            });
        }

        if (chatSendBtn) {
            chatSendBtn.addEventListener('click', handleUserSend);
        }

        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleUserSend();
            });
        }

        if (quickBtns) {
            quickBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const question = btn.getAttribute('data-question');
                    if (question) sendQuery(question);
                });
            });
        }

        // Auto-abrir el chatbot con pequeña animación de entrada
        setTimeout(() => {
            chatbotContainer.classList.add('active');
            chatToggleBtn.classList.add('hidden');
            scrollToBottom();
        }, 300);
    }

    // Inicialización robusta dependiente del estado del DOM
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', initChatbot);
    } else {
        initChatbot();
    }

    // ==========================================================================
    // FUNCIONES PRINCIPALES DEL CHATBOT
    // ==========================================================================

    function handleUserSend() {
        if (!chatInput) return;
        const text = chatInput.value.trim();
        if (!text) return;
        chatInput.value = '';
        sendQuery(text);
    }

    async function sendQuery(queryText) {
        // 1. Mostrar mensaje del usuario en la UI
        appendMessage(queryText, 'user');
        scrollToBottom();

        // Validación fuera de contexto
        if (esFueraDeContexto(queryText)) {
            showTyping(true);
            setTimeout(() => {
                showTyping(false);
                const respuesta = 'Lo siento, como Asistente Nicolaita solo puedo responder preguntas relacionadas con el Colegio Primitivo y Nacional de San Nicolás de Hidalgo (horarios, admisiones, planes de estudio, historia, etc.).';
                appendMessage(respuesta, 'bot');
                scrollToBottom();
            }, 600);
            return;
        }

        // 2. Agregar al historial de conversación
        conversationHistory.push({
            role:  'user',
            parts: [{ text: queryText }]
        });

        // 3. Mostrar indicador de escritura
        showTyping(true);
        scrollToBottom();

        try {
            // 4. Llamar a la API de Gemini con instrucción dinámica
            const response = await fetch(GEMINI_API_URL, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: conversationHistory,
                    systemInstruction: {
                        parts: [{ text: buildSystemInstruction(queryText) }]   // ← dinámico
                    },
                    generationConfig: {
                        temperature:     0.4,
                        topP:            0.95,
                        maxOutputTokens: 800
                    }
                })
            });

            if (!response.ok) throw new Error(`API Error: ${response.status} ${response.statusText}`);

            const data = await response.json();
            showTyping(false);

            const botResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text
                || 'Lo siento, tuve un inconveniente al procesar tu solicitud. Por favor intenta de nuevo.';

            // 5. Mostrar respuesta del bot y guardar en historial
            appendMessage(botResponseText, 'bot');
            conversationHistory.push({
                role:  'model',
                parts: [{ text: botResponseText }]
            });

            scrollToBottom();

        } catch (error) {
            console.error('Chat Error:', error);
            showTyping(false);
            appendMessage('Ocurrió un error de conexión. Asegúrate de tener conexión a Internet e inténtalo de nuevo.', 'bot');
            scrollToBottom();
        }
    }

    // Agregar burbuja de mensaje al chat
    function appendMessage(text, sender) {
        if (!chatLog) return;
        const messageRow      = document.createElement('div');
        messageRow.className  = `message-row ${sender === 'user' ? 'user-row' : 'bot-row'}`;

        let htmlContent = '';

        if (sender === 'user') {
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

    function showTyping(show) {
        if (!typingIndicator) return;
        if (show) {
            typingIndicator.classList.remove('hidden');
        } else {
            typingIndicator.classList.add('hidden');
        }
    }

    function scrollToBottom() {
        if (chatBody) chatBody.scrollTop = chatBody.scrollHeight;
    }

    // ==========================================================================
    // UTILIDADES: formateo de texto, escape de HTML, etc.
    // ==========================================================================

    function escapeHTML(str) {
        return str
            .replace(/&/g,  '&amp;')
            .replace(/</g,  '&lt;')
            .replace(/>/g,  '&gt;')
            .replace(/"/g,  '&quot;')
            .replace(/'/g,  '&#039;');
    }

    function formatMarkdown(text) {
        let formatted = escapeHTML(text);

        // Negritas: **texto** → <strong>texto</strong>
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Listas: líneas que empiezan con * o - → bullet
        formatted = formatted.replace(/^(?:\*|-)\s+(.*?)$/gm, '• $1');

        // Saltos de línea
        formatted = formatted.replace(/\n/g, '<br>');

        // Autoenlace de correos
        formatted = formatted.replace(
            /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi,
            '<a href="mailto:$1" class="text-gold">$1</a>'
        );

        // Autoenlace de URLs https://
        formatted = formatted.replace(
            /(https?:\/\/[^\s<]+)/gi,
            '<a href="$1" target="_blank" class="text-gold">$1 <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.7rem;"></i></a>'
        );

        // Autoenlace de www.
        formatted = formatted.replace(
            /(^|[^/])(www\.[^\s<]+)/gi,
            '$1<a href="https://$2" target="_blank" class="text-gold">$2 <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.7rem;"></i></a>'
        );

        return formatted;
    }
}
