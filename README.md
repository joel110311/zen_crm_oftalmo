# Zen CRM Go

CRM conversacional para WhatsApp con inbox multiusuario, bot con IA, RAG interno, pipeline visual, agenda y canal QR sobre librerias Go.

Este repositorio esta preparado para despliegue tipo SaaS por instancia: cada cliente levanta su propio stack, conecta su numero por QR, configura sus claves y trabaja sobre una base limpia, sin mensajes ni leads precargados.

## Stack

- `zen-crm`: Next.js + Prisma + pgvector
- `zen-crm-db`: PostgreSQL con extension vector
- `whatsapp-gateway`: WuzAPI sobre Go / whatsmeow para login por QR

## Funciones principales

- Inbox de WhatsApp con takeover humano / IA
- Recepcion y envio de texto, imagen, audio, video y documentos
- Plantillas internas
- Pipeline editable con etapas y presets
- Base de conocimiento con texto, archivos, URLs, sitemap, GitHub y YouTube
- Agenda interna y sincronizacion con Google Calendar
- Scoring comercial y captura de datos del lead

## Seguridad de claves IA

Por defecto, el CRM **no usa silenciosamente** `OPENAI_API_KEY` ni `GEMINI_API_KEY` del contenedor.

La prioridad ahora es:

1. clave guardada por el cliente en `Configuracion > IA`
2. variables de entorno **solo** si `ALLOW_ENV_AI_FALLBACK=true`

Para despliegue SaaS por cliente, la recomendacion es:

- `ALLOW_ENV_AI_FALLBACK=false`
- que cada cliente guarde su propia clave en `Configuracion > IA`

## Despliegue con Docker / Portainer

Usa `docker-compose.zen-crm.yml`.

Para Portainer, toma como base las variables de `portainer.env.example`.

### Variables requeridas

- `POSTGRES_DB`
- `POSTGRES_PASSWORD`
- `WUZAPI_ADMIN_TOKEN`
- `WUZAPI_GLOBAL_ENCRYPTION_KEY`
- `AUTH_SECRET`
- `AUTH_URL`
- `APP_BASE_URL`
- `WHATSAPP_WEBHOOK_BASE_URL`
- `APP_DOMAIN`
- `INITIAL_ADMIN_EMAIL`
- `INITIAL_ADMIN_PASSWORD`

### Variables opcionales

- `INITIAL_ADMIN_NAME`
- `WUZAPI_USER_TOKEN`
- `WHATSAPP_INSTANCE_NAME`
- `SESSION_DEVICE_NAME`
- `TRAEFIK_NETWORK`
- `TRAEFIK_ENTRYPOINT`
- `TRAEFIK_CERTRESOLVER`
- `STACK_SLUG`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `ALLOW_ENV_AI_FALLBACK`
- `TZ`

### Arranque

```bash
docker compose -f docker-compose.zen-crm.yml up -d
```

### Recomendacion para Portainer

1. crea un stack nuevo
2. pega el contenido de `docker-compose.zen-crm.yml`
3. carga las variables de `portainer.env.example` adaptadas al cliente
4. asigna un `APP_DOMAIN` unico por cliente, por ejemplo `crm.cliente.com`
5. asigna un `STACK_SLUG` unico por cliente, por ejemplo `zencrm-cliente-a`
6. deja `ALLOW_ENV_AI_FALLBACK=false` para que el CRM no use claves IA del servidor

Con esto evitas choques de routers/servicios de Traefik al desplegar varias instancias.

## Primer acceso

En una base nueva, el contenedor crea automaticamente:

- estructura base de la app
- pipeline inicial limpio
- un usuario `SUPERADMIN` con los datos definidos en `INITIAL_ADMIN_EMAIL` y `INITIAL_ADMIN_PASSWORD`

Luego:

1. entra al CRM
2. ve a `Configuracion > WhatsApp`
3. prepara el canal
4. conecta por QR
5. ve a `Configuracion > IA`
6. guarda la clave del cliente

## Healthcheck

El stack expone un endpoint de salud en `/api/health`, usado por Docker para verificar que:

- la app responde
- Prisma puede consultar la base

Ejemplo:

```bash
curl https://crm.cliente.com/api/health
```

## Base limpia para clientes nuevos

La imagen de PostgreSQL ya no usa dumps con datos historicos.

Cada despliegue nuevo arranca sin:

- contactos
- conversaciones
- mensajes
- leads
- citas
- plantillas

Solo se crea la base minima operativa para que el cliente pueda iniciar.

## Desarrollo local

```bash
docker compose -f docker-compose.local.yml up -d --build
```

El compose local deja `ALLOW_ENV_AI_FALLBACK=true` para facilitar pruebas con variables de entorno.
