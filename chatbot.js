'use strict';
// Vulpes Nicolaita Chatbot — browser client
(function () {
    const GEMINI_CHAT_URL = (window.VULPES_CONFIG && window.VULPES_CONFIG.apiBase)
        ? window.VULPES_CONFIG.apiBase.replace(/\/$/, '') + '/api/chat'
        : '/api/chat';

    const CONTEXT_URL = (window.VULPES_CONFIG && window.VULPES_CONFIG.apiBase)
        ? window.VULPES_CONFIG.apiBase.replace(/\/$/, '') + '/api/contexto'
        : '/api/contexto';

    const MAX_HISTORY_TURNS = 20;
    const AUTO_OPEN = !(window.VULPES_CONFIG && window.VULPES_CONFIG.autoOpen === false);

    let contextoCache = null;
    let conversationHistory = [];

    let chatToggleBtn, chatbotContainer, chatCloseBtn, chatInput, chatSendBtn;
    let chatLog, chatBody, typingIndicator, quickBtns;

    function normalizarTexto(texto) {
        return (texto || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    const TEMAS_FUERA = ['receta', 'clima', 'futbol', 'politica', 'chiste', 'poema'];
    function esFueraDeContexto(query) {
        const q = normalizarTexto(query);
        return TEMAS_FUERA.some(t => q.includes(t));
    }

    function trimHistory() {
        if (conversationHistory.length > MAX_HISTORY_TURNS * 2) {
            conversationHistory = conversationHistory.slice(-MAX_HISTORY_TURNS * 2);
        }
    }

    async function fetchContexto() {
        try {
            const res = await fetch(CONTEXT_URL);
            if (res.ok) {
                contextoCache = await res.json();
                const n = contextoCache.urlsSitio ? contextoCache.urlsSitio.length : 0;
                console.log('[Vulpes] Site context loaded: ' + n + ' pages.');
            }
        } catch (e) {
            console.warn('[Vulpes] Could not load dynamic context.', e);
        }
    }

    async function initChatbot() {
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
            console.warn('[Vulpes] Chatbot DOM elements not found.');
            return;
        }

        chatToggleBtn.addEventListener('click', openChat);
        if (chatCloseBtn) chatCloseBtn.addEventListener('click', closeChat);
        if (chatSendBtn)  chatSendBtn.addEventListener('click', handleUserSend);
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

        if (AUTO_OPEN) {
            setTimeout(openChat, 300);
        }
    }

    function openChat() {
        chatbotContainer.classList.add('active');
        chatToggleBtn.classList.add('hidden');
        if (chatInput) chatInput.focus();
        scrollToBottom();
    }

    function closeChat() {
        chatbotContainer.classList.remove('active');
        chatToggleBtn.classList.remove('hidden');
    }

    function handleUserSend() {
        if (!chatInput) return;
        const text = chatInput.value.trim();
        if (!text) return;
        chatInput.value = '';
        sendQuery(text);
    }

    async function sendQuery(queryText) {
        appendMessage(queryText, 'user');
        scrollToBottom();

        if (esFueraDeContexto(queryText)) {
            showTyping(true);
            setTimeout(() => {
                showTyping(false);
                appendMessage(
                    'Lo siento, como Asistente Nicolaita solo puedo responder preguntas relacionadas con el Colegio Primitivo y Nacional de San Nicolás de Hidalgo.',
                    'bot'
                );
                scrollToBottom();
            }, 600);
            return;
        }

        showTyping(true);
        scrollToBottom();

        try {
            const response = await fetch(GEMINI_CHAT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: conversationHistory.concat([{
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

            conversationHistory.push({ role: 'user', parts: [{ text: queryText }] });
            conversationHistory.push({ role: 'model', parts: [{ text: botResponseText }] });
            trimHistory();

            appendMessage(botResponseText, 'bot');
            scrollToBottom();

        } catch (error) {
            console.error('[Vulpes] Chat error:', error);
            showTyping(false);
            appendMessage(
                error.message || 'Ocurrió un error de conexión. Inténtalo de nuevo.',
                'bot'
            );
            scrollToBottom();
        }
    }

    function appendMessage(text, sender) {
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
                    '<img src="images/zorroicon.png" alt="Asistente Nicolaita">' +
                '</div>' +
                '<div class="message-bubble bot-bubble">' + formatMarkdown(cleanText) + '</div>';
        }

        chatLog.appendChild(messageRow);
    }

    function showTyping(show) {
        if (!typingIndicator) return;
        typingIndicator.classList.toggle('hidden', !show);
    }

    function scrollToBottom() {
        if (chatBody) chatBody.scrollTop = chatBody.scrollHeight;
    }

    function escapeHTML(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatMarkdown(text) {
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
            '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-gold">$1</a>'
        );
        formatted = formatted.replace(
            /(^|[^/])(www\.[^\s<]+)/gi,
            '$1<a href="https://$2" target="_blank" rel="noopener noreferrer" class="text-gold">$2</a>'
        );
        return formatted;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initChatbot);
    } else {
        initChatbot();
    }

    window.VulpesChat = {
        open: openChat,
        close: closeChat,
        reset: function () {
            conversationHistory = [];
            if (chatLog) chatLog.innerHTML = '';
        }
    };
})();
