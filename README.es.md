# Vulpes — Asistente Virtual Nicolaita

Asistente virtual del **Colegio Primitivo y Nacional de San Nicolás de Hidalgo** (UMSNH). Responde preguntas sobre admisiones, horarios, trámites e historia usando datos oficiales curados y un índice semanal de [colegio.umich.mx](https://www.colegio.umich.mx).

> English: see [README.md](README.md)

## Características

- Widget de chat flotante con Google Gemini
- Fuente única de datos oficiales (`data/official.json`)
- Crawler semanal del sitio del colegio (sin dependencias npm)
- Prompt del sistema en el servidor (el cliente no puede modificarlo)
- Rate limiting, límite de tamaño, health check, CORS configurable
- Widget embebible para integración con el sitio del colegio

## Requisitos

- Node.js 18+
- [Clave de API de Google Gemini](https://aistudio.google.com/apikey)

## Inicio rápido

```bash
cp .env.example .env
# Edita .env y coloca GEMINI_API_KEY

npm start
# Abre http://localhost:4000
```

El punto de entrada legacy (`node app.js`) sigue funcionando y delega a `server.js`.

## Estructura del proyecto

```
vulpes/
├── server.js           # Servidor HTTP + rutas API
├── chatbot.js          # Cliente del chat en el navegador
├── crawler.js          # Indexador del sitio
├── widget.js           # Cargador embebible para colegio.umich.mx
├── embed.html          # Página del chat para iframe
├── data/
│   └── official.json   # Datos oficiales curados (fuente única)
├── lib/
│   ├── env.js          # Cargador de .env
│   ├── official-data.js# Constructor del prompt desde official.json
│   └── security.js     # Rate limit, CORS, límites de body
├── cache/
│   └── datos.json      # Índice del sitio (generado automáticamente)
└── index.html          # Página demo standalone
```

## Actualizar datos oficiales

Edita **`data/official.json`** cuando el colegio publique nuevos avisos (especialmente fechas de convocatoria). Actualiza `meta.lastVerified` con la fecha en que verificaste la información.

El prompt del sistema se construye desde este archivo en cada petición de chat. El crawler agrega páginas dinámicas del sitio como sección 7 del prompt.

## Endpoints de la API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Estado del servicio e info del cache |
| GET | `/api/contexto` | Índice del sitio + campos oficiales |
| POST | `/api/chat` | Proxy de chat (Gemini). Body: `{ contents, query }` |
| POST | `/api/actualizar-cache` | Disparar crawler (token Bearer opcional) |

### Forzar actualización del cache

```bash
curl -X POST http://localhost:4000/api/actualizar-cache
# Con token:
curl -X POST -H "Authorization: Bearer TU_TOKEN" http://localhost:4000/api/actualizar-cache
```

## Integración en colegio.umich.mx

Recomendado: modo **iframe** (aislado, sin problemas de CORS).

```html
<script
  src="https://TU-SERVIDOR-VULPES/widget.js"
  data-base-url="https://TU-SERVIDOR-VULPES"
  data-mode="iframe"
  async
></script>
```

Opciones:

| Atributo | Default | Descripción |
|----------|---------|-------------|
| `data-base-url` | origen del script | URL del servidor Vulpes |
| `data-mode` | `iframe` | `iframe` o `inline` |
| `data-position` | `bottom-right` | `bottom-right` o `bottom-left` |
| `data-z-index` | `9999` | Orden de apilamiento |

Para modo inline en otro dominio, configura `CORS_ORIGINS` en `.env`.

## Checklist de producción

1. Configura `GEMINI_API_KEY` en el servidor (nunca en el navegador)
2. Define `CORS_ORIGINS` con los dominios permitidos del colegio
3. Define `CACHE_UPDATE_TOKEN` para proteger la actualización del cache
4. Coloca Node detrás de HTTPS (nginx, Caddy, Cloudflare, etc.)
5. Monitorea `/health` para verificar disponibilidad
6. Revisa `data/official.json` cuando haya nuevas convocatorias

## Variables de entorno

Consulta [`.env.example`](.env.example) para todas las opciones.

## Licencia

MIT
