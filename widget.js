/**
 * Vulpes embed loader — add to any page on colegio.umich.mx
 *
 * Usage:
 *   <script
 *     src="https://YOUR-VULPES-HOST/widget.js"
 *     data-base-url="https://YOUR-VULPES-HOST"
 *     data-mode="iframe"
 *     data-position="bottom-right"
 *     async
 *   ></script>
 *
 * Modes:
 *   iframe  — floating button opens an iframe (recommended for site integration)
 *   inline  — injects the chat UI directly (requires same-origin or CORS)
 */
(function () {
    'use strict';

    var script = document.currentScript;
    if (!script) return;

    var baseUrl   = script.getAttribute('data-base-url') || new URL(script.src).origin;
    var mode      = script.getAttribute('data-mode') || 'iframe';
    var position  = script.getAttribute('data-position') || 'bottom-right';
    var zIndex    = script.getAttribute('data-z-index') || '9999';

    baseUrl = baseUrl.replace(/\/$/, '');

    if (mode === 'iframe') {
        injectIframeWidget(baseUrl, position, zIndex);
    } else if (mode === 'inline') {
        injectInlineWidget(baseUrl);
    }

    function injectIframeWidget(base, pos, z) {
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
            'justify-content:center'
        ].join(';');

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
            'background:#fff'
        ].join(';');

        var iframe = document.createElement('iframe');
        iframe.src = base + '/embed.html';
        iframe.title = 'Asistente Nicolaita';
        iframe.style.cssText = 'width:100%;height:100%;border:none;';
        iframe.setAttribute('loading', 'lazy');
        panel.appendChild(iframe);

        var open = false;
        btn.addEventListener('click', function () {
            open = !open;
            panel.style.display = open ? 'block' : 'none';
        });

        document.body.appendChild(btn);
        document.body.appendChild(panel);
    }

    function injectInlineWidget(base) {
        window.VULPES_CONFIG = {
            apiBase: base,
            autoOpen: script.getAttribute('data-auto-open') !== 'false'
        };

        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = base + '/styles.css';
        document.head.appendChild(link);

        fetch(base + '/index.html')
            .then(function (r) { return r.text(); })
            .then(function (html) {
                var container = document.createElement('div');
                container.innerHTML = html;
                var widget = container.querySelector('#chatbot-container');
                var toggle = container.querySelector('#chat-toggle');
                if (widget) document.body.appendChild(widget);
                if (toggle) document.body.appendChild(toggle);

                var s = document.createElement('script');
                s.src = base + '/chatbot.js';
                document.body.appendChild(s);
            })
            .catch(function (err) {
                console.error('[Vulpes] Inline embed failed:', err);
            });
    }
})();
