'use strict';
// =============================================================================
// crawler.js — Módulo de scraping para el Asistente Nicolaita
// Recorre colegio.umich.mx y guarda un índice en cache/datos.json
// No requiere dependencias externas (usa solo módulos nativos de Node.js)
// =============================================================================
const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

const BASE_URL   = 'https://www.colegio.umich.mx';
const MAX_PAGES  = 150;      // Límite de páginas a indexar
const DELAY_MS   = 700;      // Pausa entre peticiones (ms) para no sobrecargar el servidor
const CACHE_DIR  = path.join(__dirname, 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'datos.json');

// ─── Datos estáticos que el crawler NUNCA sobreescribe ────────────────────────
const DATOS_ESTATICOS = {
    contacto: {
        direccion:         'Av. Madero Poniente 351, Col. Centro, C.P. 58000, Morelia, Michoacán, México.',
        correo:            'sria.acad.cpnsnh@umich.mx',
        horarioMatutino:   '7:00 AM – 2:00 PM',
        horarioVespertino: '2:00 PM – 9:00 PM',
        cct:               '16UBH0019C'
    },
    horarios: {
        portal:           'https://www.colegio.umich.mx/horarios/horarios.html',
        semestresNon:     'https://www.colegio.umich.mx/horarios/semestrenon.html',
        semestresPar:     'https://www.colegio.umich.mx/horarios/semestrepar.html',
        trayectorias3non: 'https://www.colegio.umich.mx/horarios/trayectorias3non.html',
        trayectorias5non: 'https://www.colegio.umich.mx/horarios/trayectorias5non.html',
        trayectoriasPar:  'https://www.colegio.umich.mx/horarios/tacad-par.html'
    }
};

// ─── Fetch de una página con soporte de redirecciones ────────────────────────
function fetchPage(pageUrl, redirectCount) {
    redirectCount = redirectCount || 0;
    return new Promise(function (resolve) {
        if (redirectCount > 5) return resolve(null);

        var parsed;
        try { parsed = new URL(pageUrl); } catch (e) { return resolve(null); }

        var mod = parsed.protocol === 'https:' ? https : http;
        var req = mod.request(
            {
                hostname: parsed.hostname,
                path:     parsed.pathname + (parsed.search || ''),
                method:   'GET',
                headers:  {
                    'User-Agent': 'VulpesBot/1.0 (educational-chatbot)',
                    'Accept':     'text/html,application/xhtml+xml'
                },
                timeout: 12000
            },
            function (res) {
                // Manejar redirecciones 3xx
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    try {
                        var next = new URL(res.headers.location, pageUrl).href;
                        resolve(fetchPage(next, redirectCount + 1));
                    } catch (e) { resolve(null); }
                    return;
                }
                if (res.statusCode !== 200) return resolve(null);

                var chunks = [];
                res.on('data',  function (c) { chunks.push(c); });
                res.on('end',   function ()  { resolve(Buffer.concat(chunks).toString('utf-8')); });
                res.on('error', function ()  { resolve(null); });
            }
        );
        req.on('error',   function () { resolve(null); });
        req.on('timeout', function () { req.destroy(); resolve(null); });
        req.end();
    });
}

// ─── Extracción de información del HTML ──────────────────────────────────────
function extractTitle(html) {
    var m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return m ? m[1].replace(/\s+/g, ' ').trim().slice(0, 150) : '';
}

function extractDescription(html) {
    var m = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i)
         || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']description["']/i);
    return m ? m[1].trim().slice(0, 300) : '';
}

function extractText(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi,   '')
        .replace(/<!--[\s\S]*?-->/g,             '')
        .replace(/<[^>]+>/g,                     ' ')
        .replace(/(Página Principal|Dirección|Redes Sociales|Copyright|WebMaster|AI Website|Drag and Drop|Best AI|No Code|Free AI)/gi, '')
        .replace(/\s+/g,                         ' ')
        .trim()
        .slice(0, 800);
}

function extractLinks(html, baseUrl) {
    var found = {};
    var re = /href=["']([^"'#?]+)/gi;
    var m;
    // Extensiones de archivo a ignorar
    var skipExt = /\.(pdf|jpg|jpeg|png|gif|svg|ico|css|js|zip|docx?|xlsx?|pptx?|mp4|mp3|avi|mov)$/i;

    while ((m = re.exec(html)) !== null) {
        try {
            var resolved = new URL(m[1], baseUrl).href.split('?')[0].split('#')[0];
            if (resolved.startsWith(BASE_URL) && !skipExt.test(resolved)) {
                found[resolved] = true;
            }
        } catch (e) { /* ignorar URLs inválidas */ }
    }
    return Object.keys(found);
}

function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
}

// ─── Recorrido principal del sitio ───────────────────────────────────────────
async function crawl() {
    console.log('\n🕷️  [Crawler] Iniciando recorrido de ' + BASE_URL + ' …');

    var visited = {};
    var queue   = [BASE_URL + '/'];
    var results = [];
    var count   = 0;

    while (queue.length > 0 && count < MAX_PAGES) {
        var current = queue.shift();
        if (visited[current]) continue;
        visited[current] = true;
        count++;

        process.stdout.write('  → [' + String(count).padStart(3, ' ') + '/' + MAX_PAGES + '] ' + current + '\n');

        var html = await fetchPage(current);
        if (html) {
            var titulo      = extractTitle(html);
            var descripcion = extractDescription(html);
            var contenido   = extractText(html);
            var links       = extractLinks(html, current);

            results.push({ url: current, titulo: titulo, descripcion: descripcion, contenido: contenido });

            for (var i = 0; i < links.length; i++) {
                if (!visited[links[i]] && queue.indexOf(links[i]) === -1) {
                    queue.push(links[i]);
                }
            }
        }
        await sleep(DELAY_MS);
    }

    console.log('✅ [Crawler] Listo. ' + results.length + ' páginas indexadas.\n');
    return results;
}

// ─── Actualizar el archivo cache/datos.json ───────────────────────────────────
async function actualizarCache() {
    // Crear el directorio cache si no existe
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }

    var urlsSitio = await crawl();

    var cache = Object.assign(
        { ultimaActualizacion: new Date().toISOString() },
        DATOS_ESTATICOS,
        { urlsSitio: urlsSitio }
    );

    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
    console.log('💾 [Crawler] Cache guardado en: ' + CACHE_FILE);
    return cache;
}

// ─── Helpers exportados para app.js ──────────────────────────────────────────
function leerCache() {
    if (!fs.existsSync(CACHE_FILE)) return null;
    try   { return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8')); }
    catch (e) { return null; }
}

function cacheEsViejo(diasMax) {
    diasMax = diasMax || 7;
    var cache = leerCache();
    if (!cache || !cache.ultimaActualizacion) return true;
    var diffDias = (Date.now() - new Date(cache.ultimaActualizacion).getTime()) / 86400000;
    return diffDias >= diasMax;
}

// Crear cache inicial con datos estáticos si no existe
function inicializarCacheEstatico() {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    if (!fs.existsSync(CACHE_FILE)) {
        var inicial = Object.assign(
            { ultimaActualizacion: null },
            DATOS_ESTATICOS,
            { urlsSitio: [] }
        );
        fs.writeFileSync(CACHE_FILE, JSON.stringify(inicial, null, 2), 'utf-8');
        console.log('📂 [Crawler] Cache inicial creado en: ' + CACHE_FILE);
    }
}

module.exports = {
    actualizarCache,
    leerCache,
    cacheEsViejo,
    inicializarCacheEstatico,
    CACHE_FILE,
    DATOS_ESTATICOS
};
