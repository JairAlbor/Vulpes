# Vulpes — Nicolaita Virtual Assistant

Virtual assistant for the **Colegio Primitivo y Nacional de San Nicolás de Hidalgo** (UMSNH). Answers questions about admissions, schedules, procedures, and school history using curated official data and a weekly index of [colegio.umich.mx](https://www.colegio.umich.mx).

> Español: see [README.es.md](README.es.md)

## Features

- Floating chat widget powered by Google Gemini
- Single source of truth for official data (`data/official.json`)
- Weekly crawler of the school website (no npm dependencies)
- Server-side system prompt (client cannot tamper with instructions)
- Rate limiting, body size limits, health check, optional CORS lockdown
- Embeddable widget for integration with the school site

## Requirements

- Node.js 18+
- A [Google Gemini API key](https://aistudio.google.com/apikey)

## Quick start

```bash
cp .env.example .env
# Edit .env and set GEMINI_API_KEY

npm start
# Open http://localhost:4000
```

Legacy entry point (`node app.js`) still works and delegates to `server.js`.

## Project structure

```
vulpes/
├── server.js           # HTTP server + API routes
├── chatbot.js          # Browser chat client
├── crawler.js          # Site indexer
├── widget.js           # Embed loader for colegio.umich.mx
├── embed.html          # Iframe-friendly chat page
├── data/
│   └── official.json   # Curated official data (single source of truth)
├── lib/
│   ├── env.js          # .env loader
│   ├── official-data.js# Prompt builder from official.json
│   └── security.js     # Rate limit, CORS, body limits
├── cache/
│   └── datos.json      # Crawled site index (auto-generated)
└── index.html          # Standalone demo page
```

## Updating official data

Edit **`data/official.json`** when the school publishes new notices (especially convocatoria dates). Set `meta.lastVerified` to the date you checked.

The system prompt is built from this file on every chat request. The crawler adds dynamic pages from the website as section 7 of the prompt.

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service status and cache info |
| GET | `/api/contexto` | Cached site index + official fields |
| POST | `/api/chat` | Chat proxy (Gemini). Body: `{ contents, query }` |
| POST | `/api/actualizar-cache` | Trigger crawler (optional Bearer token) |

### Force cache refresh

```bash
curl -X POST http://localhost:4000/api/actualizar-cache
# With token:
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" http://localhost:4000/api/actualizar-cache
```

## Embedding on colegio.umich.mx

Recommended: **iframe mode** (isolated, no CORS issues).

```html
<script
  src="https://YOUR-VULPES-HOST/widget.js"
  data-base-url="https://YOUR-VULPES-HOST"
  data-mode="iframe"
  async
></script>
```

Options:

| Attribute | Default | Description |
|-----------|---------|-------------|
| `data-base-url` | script origin | Vulpes server URL |
| `data-mode` | `iframe` | `iframe` or `inline` |
| `data-position` | `bottom-right` | `bottom-right` or `bottom-left` |
| `data-z-index` | `9999` | Stack order |

For inline mode on another domain, set `CORS_ORIGINS` in `.env`.

## Production checklist

1. Set `GEMINI_API_KEY` on the server (never expose it to the browser)
2. Set `CORS_ORIGINS` to allowed school domains
3. Set `CACHE_UPDATE_TOKEN` to protect cache refresh endpoint
4. Put Node behind HTTPS (nginx, Caddy, Cloudflare, etc.)
5. Monitor `/health` for uptime checks
6. Review `data/official.json` when new convocatorias are published

## Environment variables

See [`.env.example`](.env.example) for all options.

## License

MIT
