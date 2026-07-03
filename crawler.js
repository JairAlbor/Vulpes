'use strict';
// =============================================================================
// crawler.js — Scraping module for the Nicolaita Assistant
// Crawls colegio.umich.mx and stores an index in cache/datos.json
// No external dependencies (Node.js built-in modules only)
// =============================================================================
const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

const officialData = require('./lib/official-data');

const BASE_URL   = 'https://www.colegio.umich.mx';
const SITEMAP_URL = BASE_URL + '/sitemap.xml';
const MAX_PAGES  = parseInt(process.env.CRAWLER_MAX_PAGES || '150', 10);
const DELAY_MS   = parseInt(process.env.CRAWLER_DELAY_MS  || '700', 10);
const CACHE_DIR  = path.join(__dirname, 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'datos.json');

const HTML_ENTITIES = {
    '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>',
    '&quot;': '"', '&#39;': "'", '&aacute;': 'á', '&eacute;': 'é',
    '&iacute;': 'í', '&oacute;': 'ó', '&uacute;': 'ú', '&ntilde;': 'ñ',
    '&Aacute;': 'Á', '&Eacute;': 'É', '&Iacute;': 'Í', '&Oacute;': 'Ó',
    '&Uacute;': 'Ú', '&Ntilde;': 'Ñ'
};

function decodeHtmlEntities(text) {
    return (text || '')
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
        .replace(/&[a-zA-Z#0-9]+;/g, entity => HTML_ENTITIES[entity] || entity);
}

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
                    'User-Agent': 'VulpesBot/1.0 (educational-chatbot; +https://colegio.umich.mx)',
                    'Accept':     'text/html,application/xhtml+xml,application/xml'
                },
                timeout: 12000
            },
            function (res) {
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

function extractTitle(html) {
    var m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return decodeHtmlEntities(m ? m[1].replace(/\s+/g, ' ').trim().slice(0, 150) : '');
}

function extractDescription(html) {
    var m = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i)
         || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']description["']/i);
    return decodeHtmlEntities(m ? m[1].trim().slice(0, 300) : '');
}

function extractText(html) {
    return decodeHtmlEntities(
        html
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi,   '')
            .replace(/<!--[\s\S]*?-->/g,             '')
            .replace(/<[^>]+>/g,                     ' ')
            .replace(/(Página Principal|Dirección|Redes Sociales|Copyright|WebMaster|AI Website|Drag and Drop|Best AI|No Code|Free AI)/gi, '')
            .replace(/\s+/g,                         ' ')
            .trim()
            .slice(0, 800)
    );
}

function extractLinks(html, baseUrl) {
    var found = {};
    var re = /href=["']([^"'#?]+)/gi;
    var m;
    var skipExt = /\.(pdf|jpg|jpeg|png|gif|svg|ico|css|js|zip|docx?|xlsx?|pptx?|mp4|mp3|avi|mov)$/i;

    while ((m = re.exec(html)) !== null) {
        try {
            var resolved = new URL(m[1], baseUrl).href.split('?')[0].split('#')[0];
            if (resolved.startsWith(BASE_URL) && !skipExt.test(resolved)) {
                found[resolved] = true;
            }
        } catch (e) { /* ignore invalid URLs */ }
    }
    return Object.keys(found);
}

function extractPdfLinks(html, pageUrl) {
    var pdfs = [];
    var re = /<a\s+([^>]*href=["']([^"']+\.pdf[^"']*)["'][^>]*)>([\s\S]*?)<\/a>/gi;
    var m;
    while ((m = re.exec(html)) !== null) {
        var fullTagAttr = m[1];
        var pdfUrlRaw = m[2];
        var anchorText = m[3] || '';

        try {
            var url = new URL(pdfUrlRaw, pageUrl).href.split('#')[0];
            if (url.startsWith(BASE_URL)) {
                var titleMatch = fullTagAttr.match(/title=["']([^"']+)["']/i);
                var titleAttr = titleMatch ? titleMatch[1] : '';

                var cleanText = anchorText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                cleanText = decodeHtmlEntities(cleanText);

                var titleAttrClean = decodeHtmlEntities(titleAttr.trim());

                var finalTitle = '';
                var lowercaseText = cleanText.toLowerCase();
                var genericWords = ['descargar', 'aqui', 'pdf', 'click', 'clic', 'ver', 'leer', 'enlace', 'link', 'descarga', 'documento', 'archivo'];
                var isGeneric = genericWords.includes(lowercaseText) || lowercaseText.length < 3;

                if (cleanText && !isGeneric) {
                    finalTitle = cleanText;
                } else if (titleAttrClean) {
                    finalTitle = titleAttrClean;
                } else if (cleanText) {
                    finalTitle = cleanText;
                } else {
                    var filename = url.substring(url.lastIndexOf('/') + 1);
                    finalTitle = decodeURIComponent(filename).replace(/[-_]/g, ' ').replace(/\.pdf$/i, '');
                }

                pdfs.push({
                    url: url,
                    foundOn: pageUrl,
                    titulo: finalTitle
                });
            }
        } catch (e) { /* ignore */ }
    }
    return pdfs;
}

function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
}

async function fetchSitemapUrls() {
    var xml = await fetchPage(SITEMAP_URL);
    if (!xml) return [];

    var urls = [];
    var re = /<loc>([^<]+)<\/loc>/gi;
    var m;
    while ((m = re.exec(xml)) !== null) {
        var url = m[1].trim().split('?')[0].split('#')[0];
        if (url.startsWith(BASE_URL) && !/\.(pdf|jpg|jpeg|png|gif|svg|ico|css|js|zip)$/i.test(url)) {
            urls.push(url);
        }
    }
    return urls;
}

async function crawl() {
    console.log('\n[Crawler] Starting crawl of ' + BASE_URL + ' …');

    var visited = {};
    var queueSet = {};
    var queue = [BASE_URL + '/'];
    queueSet[BASE_URL + '/'] = true;

    var sitemapUrls = await fetchSitemapUrls();
    if (sitemapUrls.length > 0) {
        console.log('[Crawler] Sitemap found: ' + sitemapUrls.length + ' URLs.');
        for (var s = 0; s < sitemapUrls.length; s++) {
            if (!queueSet[sitemapUrls[s]]) {
                queue.push(sitemapUrls[s]);
                queueSet[sitemapUrls[s]] = true;
            }
        }
    }

    var results = [];
    var pdfIndex = [];
    var seenPdfs = {};
    var count = 0;

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
            var pdfs        = extractPdfLinks(html, current);

            results.push({ url: current, titulo: titulo, descripcion: descripcion, contenido: contenido });

            for (var p = 0; p < pdfs.length; p++) {
                var key = pdfs[p].url + '|||' + pdfs[p].foundOn;
                if (!seenPdfs[key]) {
                    seenPdfs[key] = true;
                    pdfIndex.push({
                        url: pdfs[p].url,
                        foundOn: pdfs[p].foundOn,
                        titulo: pdfs[p].titulo
                    });
                }
            }

            for (var i = 0; i < links.length; i++) {
                if (!visited[links[i]] && !queueSet[links[i]]) {
                    queue.push(links[i]);
                    queueSet[links[i]] = true;
                }
            }
        }
        await sleep(DELAY_MS);
    }

    console.log('[Crawler] Done. ' + results.length + ' pages, ' + pdfIndex.length + ' PDF references.\n');
    return { urlsSitio: results, pdfIndex: pdfIndex };
}

async function actualizarCache() {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }

    var crawlResult = await crawl();
    var staticFields = officialData.getStaticCacheFields();

    var cache = Object.assign(
        { ultimaActualizacion: new Date().toISOString() },
        staticFields,
        { urlsSitio: crawlResult.urlsSitio, pdfIndex: crawlResult.pdfIndex }
    );

    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
    console.log('[Crawler] Cache saved to: ' + CACHE_FILE);
    return cache;
}

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

function inicializarCacheEstatico() {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    if (!fs.existsSync(CACHE_FILE)) {
        var staticFields = officialData.getStaticCacheFields();
        var inicial = Object.assign(
            { ultimaActualizacion: null },
            staticFields,
            { urlsSitio: [], pdfIndex: [] }
        );
        fs.writeFileSync(CACHE_FILE, JSON.stringify(inicial, null, 2), 'utf-8');
        console.log('[Crawler] Initial cache created at: ' + CACHE_FILE);
    }
}

module.exports = {
    actualizarCache,
    leerCache,
    cacheEsViejo,
    inicializarCacheEstatico,
    CACHE_FILE,
    decodeHtmlEntities
};
