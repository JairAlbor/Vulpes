'use strict';

const MAX_BODY_BYTES   = parseInt(process.env.MAX_BODY_BYTES   || '32768', 10);
const RATE_LIMIT_MAX   = parseInt(process.env.RATE_LIMIT_MAX   || '30',    10);
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);

const rateBuckets = new Map();

function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0].trim();
    return req.socket.remoteAddress || 'unknown';
}

function isRateLimited(ip) {
    const now  = Date.now();
    const bucket = rateBuckets.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

    if (now > bucket.resetAt) {
        bucket.count   = 0;
        bucket.resetAt = now + RATE_LIMIT_WINDOW_MS;
    }

    bucket.count++;
    rateBuckets.set(ip, bucket);
    return bucket.count > RATE_LIMIT_MAX;
}

function getAllowedOrigins() {
    const raw = process.env.CORS_ORIGINS || '';
    if (!raw.trim()) return null;
    return raw.split(',').map(o => o.trim()).filter(Boolean);
}

function applyCors(req, res) {
    const allowed = getAllowedOrigins();
    const origin  = req.headers.origin;

    if (!allowed) {
        if (origin) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Vary', 'Origin');
        }
        return;
    }

    if (origin && allowed.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
}

function handlePreflight(req, res) {
    if (req.method !== 'OPTIONS') return false;
    applyCors(req, res);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.writeHead(204);
    res.end();
    return true;
}

function readBody(req, res) {
    return new Promise((resolve, reject) => {
        let body = '';
        let size = 0;

        req.on('data', chunk => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                reject(new Error('PAYLOAD_TOO_LARGE'));
                req.destroy();
                return;
            }
            body += chunk.toString();
        });

        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

function jsonResponse(res, status, payload, req) {
    if (req) applyCors(req, res);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(payload));
}

function checkApiAuth(req) {
    const token = process.env.CACHE_UPDATE_TOKEN;
    if (!token) return true;
    const auth = req.headers.authorization || '';
    return auth === 'Bearer ' + token;
}

module.exports = {
    MAX_BODY_BYTES,
    RATE_LIMIT_MAX,
    getClientIp,
    isRateLimited,
    applyCors,
    handlePreflight,
    readBody,
    jsonResponse,
    checkApiAuth
};
