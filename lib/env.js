'use strict';

const fs   = require('fs');
const path = require('path');

function loadEnv() {
    const envPath = path.join(__dirname, '..', '.env');
    if (!fs.existsSync(envPath)) return;

    try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            const index = trimmed.indexOf('=');
            if (index === -1) return;
            const key = trimmed.substring(0, index).trim();
            let val = trimmed.substring(index + 1).trim();
            if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
                val = val.substring(1, val.length - 1);
            }
            process.env[key] = val;
            process.env[key.toUpperCase()] = val;
        });
    } catch (e) {
        console.error('Error loading .env:', e.message);
    }
}

module.exports = { loadEnv };
