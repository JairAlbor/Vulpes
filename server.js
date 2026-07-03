'use strict';

const http    = require('http');
const https   = require('https');
const fs      = require('fs');
const path    = require('path');

const { loadEnv } = require('./lib/env');
const officialData = require('./lib/official-data');
const security     = require('./lib/security');
const crawler      = require('./crawler');

loadEnv();

const ROOT = __dirname;
let port = parseInt(process.env.PORT || 4000, 10);

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

let cacheUpdateInProgress = false;

function getContextoCache() {
    const cache = crawler.leerCache();
    if (cache) return cache;
    const staticFields = officialData.getStaticCacheFields();
    return Object.assign(
        { ultimaActualizacion: null, urlsSitio: [] },
        staticFields
    );
}

function handleHealth(req, res) {
    const cache = crawler.leerCache();
    security.jsonResponse(res, 200, {
        status: 'ok',
        service: 'vulpes',
        cache: {
            lastUpdate: cache && cache.ultimaActualizacion ? cache.ultimaActualizacion : null,
            pages: cache && cache.urlsSitio ? cache.urlsSitio.length : 0
        },
        officialDataVersion: officialData.loadOfficialData().meta
            ? officialData.loadOfficialData().meta.lastVerified
            : null
    }, req);
}

function handleContexto(req, res) {
    const cache = getContextoCache();
    security.applyCors(req, res);
    res.writeHead(200, {
        'Content-Type':  'application/json; charset=utf-8',
        'Cache-Control': 'no-cache'
    });
    res.end(JSON.stringify(cache));
}

async function handleChat(req, res) {
    const ip = security.getClientIp(req);

    if (security.isRateLimited(ip)) {
        security.jsonResponse(res, 429, {
            error: 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.'
        }, req);
        return;
    }

    try {
        const body = await security.readBody(req, res);
        const parsedBody = JSON.parse(body);
        const apiKey = process.env.GEMINI_API_KEY || process.env.Gemini_api_key;

        if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
            security.jsonResponse(res, 400, {
                error: 'La clave de API de Gemini no está configurada. Edita el archivo .env con una clave válida.'
            }, req);
            return;
        }

        const contents = parsedBody.contents;
        const queryText = parsedBody.query || '';
        if (!Array.isArray(contents) || contents.length === 0) {
            security.jsonResponse(res, 400, { error: 'Petición inválida: se requiere historial de conversación.' }, req);
            return;
        }

        const contextoCache = getContextoCache();
        const systemInstruction = {
            parts: [{ text: officialData.buildSystemInstruction(queryText, contextoCache) }]
        };

        const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey;
        const postData = JSON.stringify({
            contents: contents,
            systemInstruction: systemInstruction,
            generationConfig: parsedBody.generationConfig || {
                temperature: 0.4,
                topP: 0.95,
                maxOutputTokens: 800
            }
        });

        const parsedUrl = new URL(geminiUrl);
        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const geminiReq = https.request(options, geminiRes => {
            let resData = '';
            geminiRes.on('data', chunk => { resData += chunk; });
            geminiRes.on('end', () => {
                security.applyCors(req, res);
                res.writeHead(geminiRes.statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(resData);
            });
        });

        geminiReq.on('error', err => {
            console.error('Gemini proxy error:', err);
            security.jsonResponse(res, 500, {
                error: 'Error al conectar con la API de Gemini: ' + err.message
            }, req);
        });

        geminiReq.write(postData);
        geminiReq.end();

    } catch (e) {
        if (e.message === 'PAYLOAD_TOO_LARGE') {
            security.jsonResponse(res, 413, { error: 'La petición es demasiado grande.' }, req);
            return;
        }
        security.jsonResponse(res, 400, { error: 'Petición inválida.' }, req);
    }
}

async function handleCacheUpdate(req, res) {
    if (!security.checkApiAuth(req)) {
        security.jsonResponse(res, 401, { error: 'No autorizado.' }, req);
        return;
    }

    if (cacheUpdateInProgress) {
        security.jsonResponse(res, 409, { error: 'Actualización de cache en progreso.' }, req);
        return;
    }

    cacheUpdateInProgress = true;
    security.jsonResponse(res, 202, { status: 'started', message: 'Crawler iniciado en segundo plano.' }, req);

    crawler.actualizarCache()
        .then(cache => {
            console.log('Cache update complete:', cache.urlsSitio ? cache.urlsSitio.length : 0, 'pages');
        })
        .catch(err => {
            console.error('Cache update error:', err.message);
        })
        .finally(() => {
            cacheUpdateInProgress = false;
        });
}

function serveStatic(req, res, reqPath) {
    let filePath = reqPath === '/' ? '/index.html' : reqPath;
    if (filePath === '/favicon.ico') {
        filePath = '/images/zorroicon.png';
    }

    const absolutePath = path.join(ROOT, filePath);

    if (!absolutePath.startsWith(ROOT)) {
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
                res.end('Error interno: ' + err.code);
            }
            return;
        }
        const ext = path.extname(absolutePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

const server = http.createServer((req, res) => {
    if (security.handlePreflight(req, res)) return;

    const reqPath = req.url.split('?')[0].split('#')[0];

    if (reqPath === '/health' && req.method === 'GET') {
        handleHealth(req, res);
        return;
    }

    if (reqPath === '/api/contexto' && req.method === 'GET') {
        handleContexto(req, res);
        return;
    }

    if (reqPath === '/api/chat' && req.method === 'POST') {
        handleChat(req, res);
        return;
    }

    if (reqPath === '/api/actualizar-cache' && req.method === 'POST') {
        handleCacheUpdate(req, res);
        return;
    }

    serveStatic(req, res, reqPath);
});

function startServer() {
    server.listen(port, () => {
        console.log('==================================================');
        console.log('Vulpes server started');
        console.log('Running at: http://localhost:' + port);
        console.log('Health:     http://localhost:' + port + '/health');
        console.log('Press Ctrl+C to stop');
        console.log('==================================================');
    });
}

server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
        console.log('Port ' + port + ' in use. Trying ' + (port + 1) + '...');
        port++;
        startServer();
    } else {
        console.error('Server error:', err);
    }
});

startServer();

const DIAS_ENTRE_ACTUALIZACIONES = parseInt(process.env.CACHE_DAYS || '7', 10);
const MS_ENTRE_ACTUALIZACIONES   = DIAS_ENTRE_ACTUALIZACIONES * 24 * 60 * 60 * 1000;

crawler.inicializarCacheEstatico();

(async () => {
    if (crawler.cacheEsViejo(DIAS_ENTRE_ACTUALIZACIONES)) {
        console.log('\nCache outdated (>' + DIAS_ENTRE_ACTUALIZACIONES + ' days). Starting crawler in background...');
        crawler.actualizarCache().catch(err =>
            console.error('Crawler error:', err.message)
        );
    } else {
        const c = crawler.leerCache();
        const n = c && c.urlsSitio ? c.urlsSitio.length : 0;
        const fecha = c && c.ultimaActualizacion
            ? new Date(c.ultimaActualizacion).toLocaleString('es-MX')
            : 'unknown';
        console.log('\nCache OK (' + fecha + '). Indexed pages: ' + n + '.');
    }
})();

setInterval(() => {
    console.log('\nScheduled cache refresh. Starting crawler...');
    crawler.actualizarCache().catch(err =>
        console.error('Crawler error:', err.message)
    );
}, MS_ENTRE_ACTUALIZACIONES);
