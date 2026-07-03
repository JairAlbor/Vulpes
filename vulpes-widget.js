(function () {
    'use strict';

    // 1. Resolve baseUrl
    var currentScript = document.currentScript;
    var defaultBaseUrl = '';
    if (currentScript) {
        try {
            defaultBaseUrl = new URL(currentScript.src).origin;
        } catch (e) {
            defaultBaseUrl = window.location.origin;
        }
    } else {
        defaultBaseUrl = window.location.origin;
    }

    // 2. Define Web Component <nicolaita-chat>
    class NicolaitaChat extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: 'open' });
            this.contextoCache = null;
            this.conversationHistory = [];
        }

        static get observedAttributes() {
            return ['data-theme', 'theme', 'data-mode', 'mode', 'data-position', 'position'];
        }

        attributeChangedCallback(name, oldValue, newValue) {
            if (!this.shadowRoot) return;
            const container = this.shadowRoot.getElementById('chatbot-container');
            if (!container) return;
            
            if (name === 'data-theme' || name === 'theme') {
                if (newValue === 'dark') {
                    container.classList.add('theme-dark');
                    container.setAttribute('data-theme', 'dark');
                } else {
                    container.classList.remove('theme-dark');
                    container.removeAttribute('data-theme');
                }
            }
            if (name === 'data-mode' || name === 'mode') {
                this.setAttribute('data-mode', newValue);
            }
            if (name === 'data-position' || name === 'position') {
                this.setAttribute('data-position', newValue);
            }
        }

        connectedCallback() {
            const baseUrl = (this.getAttribute('data-base-url') || this.getAttribute('base-url') || defaultBaseUrl).replace(/\/$/, '');
            const mode = this.getAttribute('data-mode') || this.getAttribute('mode') || 'widget';
            const position = this.getAttribute('data-position') || this.getAttribute('position') || 'bottom-right';
            const zIndex = this.getAttribute('data-z-index') || this.getAttribute('z-index') || '9999';
            const theme = this.getAttribute('data-theme') || this.getAttribute('theme') || 'light';
            const autoOpen = !(this.getAttribute('data-auto-open') === 'false' || this.getAttribute('auto-open') === 'false');

            // Apply attributes to host for CSS styling
            this.setAttribute('data-mode', mode);
            this.setAttribute('data-position', position);
            this.setAttribute('data-theme', theme);

            // Injected styles
            const stylesLink = document.createElement('link');
            stylesLink.rel = 'stylesheet';
            stylesLink.href = `${baseUrl}/styles.css`;

            const hostStyles = document.createElement('style');
            hostStyles.textContent = `
                :host {
                    display: block;
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                }
                :host([data-mode="inline"]) {
                    width: 100%;
                    height: 100%;
                    min-height: 500px;
                }
                :host([data-mode="inline"]) .chatbot-window {
                    position: relative !important;
                    bottom: auto !important;
                    right: auto !important;
                    left: auto !important;
                    width: 100% !important;
                    height: 100% !important;
                    min-height: 500px;
                    opacity: 1 !important;
                    transform: none !important;
                    pointer-events: auto !important;
                    border-radius: var(--border-radius-lg, 16px);
                    box-shadow: var(--box-shadow-md, 0 4px 12px rgba(0,0,0,0.08));
                }
                :host([data-mode="inline"]) .chat-toggle-btn,
                :host([data-mode="inline"]) .chat-close-btn {
                    display: none !important;
                }
                :host([data-position="bottom-left"]) .chat-toggle-btn {
                    left: 24px !important;
                    right: auto !important;
                }
                :host([data-position="bottom-left"]) .chatbot-window {
                    left: 24px !important;
                    right: auto !important;
                }
                .hidden {
                    display: none !important;
                }
                svg {
                    vertical-align: middle;
                }
            `;

            const container = document.createElement('div');
            container.id = 'chatbot-container';
            container.className = 'chatbot-window';
            if (theme === 'dark') {
                container.classList.add('theme-dark');
                container.setAttribute('data-theme', 'dark');
            }

            container.innerHTML = `
                <div class="chat-header">
                    <span class="chat-header-title">Asistente Nicolaita</span>
                    <button id="chat-close" class="chat-close-btn" title="Cerrar chat" aria-label="Cerrar chat">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div id="chat-body" class="chat-body">
                    <div class="message-row bot-row">
                        <div class="bot-avatar" title="Asistente Nicolaita">
                            <img src="${baseUrl}/images/zorroicon.png" alt="Asistente Nicolaita">
                        </div>
                        <div class="message-bubble bot-bubble">
                            <p>
                                <strong>¡Hola!</strong> Pregúntame sobre admisiones, horarios, trámites y más del Colegio Primitivo y Nacional de San Nicolás de Hidalgo.
                            </p>
                        </div>
                    </div>

                    <div class="quick-options-container">
                        <button class="quick-btn" data-question="¿Cuáles son los requisitos de ingreso y el costo de la ficha?">Inscripciones y Costos</button>
                        <button class="quick-btn" data-question="¿Cuál es el calendario de la convocatoria de admisión 2026?">Calendario de Admisiones</button>
                        <button class="quick-btn" data-question="¿Qué áreas de estudio ofrece el bachillerato?">Planes de Estudio</button>
                        <button class="quick-btn" data-question="¿Cómo puedo tramitar el Seguro Facultativo del IMSS?">Seguro Facultativo</button>
                        <button class="quick-btn" data-question="¿Dónde se ubica el Colegio y en qué horarios atiende?">Ubicación y Horarios</button>
                        <button class="quick-btn" data-question="¿Dónde puedo consultar los horarios de clase y de mi sección?">Horarios de Clase</button>
                    </div>

                    <div id="chat-log" class="chat-log" role="log" aria-live="polite" aria-relevant="additions"></div>

                    <div id="typing-indicator" class="message-row bot-row hidden" aria-hidden="true">
                        <div class="bot-avatar">
                            <img src="${baseUrl}/images/zorroicon.png" alt="">
                        </div>
                        <div class="message-bubble bot-bubble typing-bubble">
                            <div class="typing-dots"><span></span><span></span><span></span></div>
                        </div>
                    </div>
                </div>

                <div class="chat-footer">
                    <input type="text" id="chat-input" placeholder="Escribe tu pregunta aquí..." autocomplete="off" aria-label="Escribe tu pregunta">
                    <button id="chat-send" class="chat-send-btn" title="Enviar mensaje" aria-label="Enviar mensaje">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                    </button>
                </div>
            `;

            // Create toggle button if not inline
            const toggleBtn = document.createElement('div');
            toggleBtn.id = 'chat-toggle';
            toggleBtn.className = 'chat-toggle-btn';
            toggleBtn.title = 'Abrir Asistente Virtual';
            toggleBtn.setAttribute('aria-label', 'Abrir chat');
            toggleBtn.style.zIndex = zIndex;
            toggleBtn.innerHTML = `
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/></svg>
                <span class="pulse-badge"></span>
            `;

            container.style.zIndex = zIndex;

            this.shadowRoot.appendChild(stylesLink);
            this.shadowRoot.appendChild(hostStyles);
            this.shadowRoot.appendChild(toggleBtn);
            this.shadowRoot.appendChild(container);

            // Bind UI Events
            const chatToggle = this.shadowRoot.getElementById('chat-toggle');
            const chatClose = this.shadowRoot.getElementById('chat-close');
            const chatInput = this.shadowRoot.getElementById('chat-input');
            const chatSend = this.shadowRoot.getElementById('chat-send');
            const chatLog = this.shadowRoot.getElementById('chat-log');
            const chatBody = this.shadowRoot.getElementById('chat-body');
            const typingIndicator = this.shadowRoot.getElementById('typing-indicator');
            const quickBtns = this.shadowRoot.querySelectorAll('.quick-btn');

            const openChat = () => {
                container.classList.add('active');
                chatToggle.classList.add('hidden');
                if (chatInput) chatInput.focus();
                scrollToBottom();
            };

            const closeChat = () => {
                container.classList.remove('active');
                chatToggle.classList.remove('hidden');
            };

            const scrollToBottom = () => {
                if (chatBody) chatBody.scrollTop = chatBody.scrollHeight;
            };

            chatToggle.addEventListener('click', openChat);
            if (chatClose) chatClose.addEventListener('click', closeChat);

            const handleUserSend = () => {
                const text = chatInput.value.trim();
                if (!text) return;
                chatInput.value = '';
                sendQuery(text);
            };

            if (chatSend) chatSend.addEventListener('click', handleUserSend);
            if (chatInput) {
                chatInput.addEventListener('keypress', e => {
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

            const normalizarTexto = (texto) => {
                return (texto || '')
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '');
            };

            const esFueraDeContexto = (query) => {
                const q = normalizarTexto(query);
                const TEMAS_FUERA = ['receta', 'clima', 'futbol', 'politica', 'chiste', 'poema'];
                return TEMAS_FUERA.some(t => q.includes(t));
            };

            const appendMessage = (text, sender) => {
                if (!chatLog) return;
                let cleanText = text;
                if (typeof cleanText === 'object') {
                    cleanText = 'Hubo un inconveniente al procesar tu solicitud. Por favor, intenta de nuevo.';
                } else if (typeof cleanText === 'string' && (
                    cleanText.includes('[object Object]') ||
                    cleanText.includes('This model is currently experiencing high demand') ||
                    cleanText.trim() === ''
                )) {
                    cleanText = 'Hubo un inconveniente al procesar tu solicitud. Por favor, intenta de nuevo.';
                }

                const messageRow = document.createElement('div');
                messageRow.className = 'message-row ' + (sender === 'user' ? 'user-row' : 'bot-row');
                messageRow.setAttribute('role', sender === 'user' ? 'status' : 'article');

                if (sender === 'user') {
                    messageRow.innerHTML =
                        '<div class="message-bubble user-bubble"><p>' + escapeHTML(cleanText) + '</p></div>';
                } else {
                    messageRow.innerHTML =
                        '<div class="bot-avatar" title="Asistente Nicolaita">' +
                            '<img src="' + baseUrl + '/images/zorroicon.png" alt="Asistente Nicolaita">' +
                        '</div>' +
                        '<div class="message-bubble bot-bubble">' + formatMarkdown(cleanText) + '</div>';
                }

                chatLog.appendChild(messageRow);
                scrollToBottom();
            };

            const escapeHTML = (str) => {
                return str
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
            };

            const formatMarkdown = (text) => {
                let formatted = escapeHTML(text);
                formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                formatted = formatted.replace(/^(?:\*|-)\s+(.*?)$/gm, '• $1');
                formatted = formatted.replace(/\n/g, '<br>');
                formatted = formatted.replace(
                    /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi,
                    '<a href="mailto:$1" class="text-gold">$1</a>'
                );
                formatted = formatted.replace(
                    /(https?:\/\/[^\s<]+)/gi,
                    '<a href="$1" target="_blank" class="text-gold">$1</a>'
                );
                return formatted;
            };

            const showTyping = (show) => {
                if (!typingIndicator) return;
                typingIndicator.classList.toggle('hidden', !show);
                scrollToBottom();
            };

            const sendQuery = async (queryText) => {
                appendMessage(queryText, 'user');

                if (esFueraDeContexto(queryText)) {
                    showTyping(true);
                    setTimeout(() => {
                        showTyping(false);
                        appendMessage(
                            'Lo siento, como Asistente Nicolaita solo puedo responder preguntas relacionadas con el Colegio Primitivo y Nacional de San Nicolás de Hidalgo.',
                            'bot'
                        );
                    }, 600);
                    return;
                }

                showTyping(true);

                try {
                    const chatUrl = `${baseUrl}/api/chat`;
                    const response = await fetch(chatUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: this.conversationHistory.concat([{
                                role: 'user',
                                parts: [{ text: queryText }]
                            }]),
                            query: queryText
                        })
                    });

                    if (!response.ok) {
                        let errorMsg = 'Error del servidor (' + response.status + ')';
                        try {
                            const errJson = await response.json();
                            if (errJson && errJson.error) {
                                errorMsg = typeof errJson.error === 'object'
                                    ? (errJson.error.message || JSON.stringify(errJson.error))
                                    : errJson.error;
                            }
                        } catch (e) { /* ignore */ }
                        throw new Error(errorMsg);
                    }

                    const data = await response.json();
                    showTyping(false);

                    if (data && data.error) {
                        const errorMsg = typeof data.error === 'object'
                            ? (data.error.message || JSON.stringify(data.error))
                            : data.error;
                        throw new Error(errorMsg);
                    }

                    const botResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text
                        || 'Lo siento, tuve un inconveniente al procesar tu solicitud. Por favor intenta de nuevo.';

                    this.conversationHistory.push({ role: 'user', parts: [{ text: queryText }] });
                    this.conversationHistory.push({ role: 'model', parts: [{ text: botResponseText }] });
                    
                    if (this.conversationHistory.length > 40) {
                        this.conversationHistory = this.conversationHistory.slice(-40);
                    }

                    appendMessage(botResponseText, 'bot');

                } catch (error) {
                    console.error('[Vulpes] Chat error:', error);
                    showTyping(false);
                    appendMessage(
                        error.message || 'Ocurrió un error de conexión. Inténtalo de nuevo.',
                        'bot'
                    );
                }
            };

            const fetchContexto = async () => {
                try {
                    const res = await fetch(`${baseUrl}/api/contexto`);
                    if (res.ok) {
                        this.contextoCache = await res.json();
                        console.log('[Vulpes Component] Site context loaded.');
                    }
                } catch (e) {
                    console.warn('[Vulpes Component] Could not load dynamic context.', e);
                }
            };

            fetchContexto().then(() => {
                if (autoOpen && mode !== 'inline') {
                    setTimeout(openChat, 1000);
                }
            });
        }
    }

    if (!customElements.get('nicolaita-chat')) {
        customElements.define('nicolaita-chat', NicolaitaChat);
    }

    // 3. Autoejecución del widget (si se carga con atributos de widget flotante de una línea)
    const initWidget = function () {
        if (!currentScript) return;
        
        const mode = currentScript.getAttribute('data-mode') || 'iframe';
        const theme = currentScript.getAttribute('data-theme') || 'light';
        const position = currentScript.getAttribute('data-position') || 'bottom-right';
        const zIndex = currentScript.getAttribute('data-z-index') || '9999';
        const autoOpen = currentScript.getAttribute('data-auto-open') || 'true';
        const baseUrl = (currentScript.getAttribute('data-base-url') || defaultBaseUrl).replace(/\/$/, '');

        // If the developer has already put <nicolaita-chat> in the page, do not duplicate it
        if (document.querySelector('nicolaita-chat')) {
            return;
        }

        if (mode === 'iframe') {
            injectIframeWidget(baseUrl, position, zIndex, theme, autoOpen);
        } else if (mode === 'inline') {
            const chatComponent = document.createElement('nicolaita-chat');
            chatComponent.setAttribute('data-base-url', baseUrl);
            chatComponent.setAttribute('data-mode', 'inline');
            chatComponent.setAttribute('data-theme', theme);
            document.body.appendChild(chatComponent);
        } else if (mode === 'webcomponent') {
            const chatComponent = document.createElement('nicolaita-chat');
            chatComponent.setAttribute('data-base-url', baseUrl);
            chatComponent.setAttribute('data-mode', 'widget');
            chatComponent.setAttribute('data-theme', theme);
            chatComponent.setAttribute('data-position', position);
            chatComponent.setAttribute('data-z-index', zIndex);
            chatComponent.setAttribute('data-auto-open', autoOpen);
            document.body.appendChild(chatComponent);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWidget);
    } else {
        initWidget();
    }

    function injectIframeWidget(base, pos, z, theme, autoOpen) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Abrir Asistente Nicolaita');
        btn.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';
        btn.style.cssText = [
            'position:fixed',
            pos.indexOf('left') >= 0 ? 'left:24px' : 'right:24px',
            'bottom:24px',
            'width:60px',
            'height:60px',
            'border-radius:50%',
            'border:3px solid #d1a153',
            'background:#0c2b53',
            'cursor:pointer',
            'z-index:' + z,
            'box-shadow:0 10px 25px rgba(0,0,0,0.2)',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        ].join(';');

        // Hover animations
        btn.onmouseover = function() {
            btn.style.transform = 'scale(1.1) rotate(5deg)';
            btn.style.borderColor = '#ffffff';
        };
        btn.onmouseout = function() {
            btn.style.transform = 'none';
            btn.style.borderColor = '#d1a153';
        };

        var panel = document.createElement('div');
        panel.style.cssText = [
            'position:fixed',
            pos.indexOf('left') >= 0 ? 'left:24px' : 'right:24px',
            'bottom:96px',
            'width:380px',
            'height:580px',
            'max-width:calc(100vw - 32px)',
            'max-height:70vh',
            'border-radius:16px',
            'overflow:hidden',
            'box-shadow:0 10px 25px rgba(0,0,0,0.2)',
            'z-index:' + z,
            'display:none',
            'background:#fff',
            'border: 1.5px solid rgba(12, 43, 83, 0.15)',
            'transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)'
        ].join(';');

        var iframe = document.createElement('iframe');
        iframe.src = base + '/embed.html?theme=' + theme + '&autoOpen=' + autoOpen + '&apiBase=' + encodeURIComponent(base);
        iframe.title = 'Asistente Nicolaita';
        iframe.style.cssText = 'width:100%;height:100%;border:none;';
        iframe.setAttribute('loading', 'lazy');
        panel.appendChild(iframe);

        var open = false;
        btn.addEventListener('click', function () {
            open = !open;
            panel.style.display = open ? 'block' : 'none';
            if (open) {
                btn.style.display = 'none';
            }
        });

        // Add message handler to close iframe from within the iframe
        window.addEventListener('message', function (event) {
            if (event.data === 'vulpes-close-chat') {
                open = false;
                panel.style.display = 'none';
                btn.style.display = 'flex';
            }
        });

        document.body.appendChild(btn);
        document.body.appendChild(panel);

        if (autoOpen === 'true') {
            setTimeout(function() {
                btn.click();
            }, 1000);
        }
    }
})();
