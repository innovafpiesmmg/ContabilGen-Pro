# ContabilGen Pro

## Overview

ContabilGen Pro es un generador de universos contables para prácticas de Grado Medio y Superior de Contabilidad (FP). Utiliza IA (DeepSeek) para generar ecosistemas contables coherentes con documentos reales del Plan General Contable español.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS (artifacts/contabilgen)
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **AI**: OpenAI gpt-5.2 via Replit AI Integrations
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Features

1. **Configuración**: Régimen fiscal (IVA/IGIC), Sector económico, Año fiscal, Nombre empresa (opcional)
2. **Generación IA**: Universo contable completo con todos los documentos
3. **Historial**: Guardar y cargar generaciones previas
4. **Documentos generados**:
   - Perfil de empresa, proveedores y clientes
   - Inventarios inicial y final (variación de existencias)
   - Fichas de almacén (warehouse cards) con PMP — computadas automáticamente desde facturas + inventario
   - Facturas de compra y venta con asientos
   - Cuadro de amortización de préstamo (Sistema Francés)
   - Liquidación de póliza de crédito
   - Extracto de tarjeta de crédito con movimientos
   - Pólizas de seguros con periodificación (cuenta 480)
   - Siniestro (cuentas 678/778)
   - Gastos e ingresos extraordinarios (multas 678, donaciones, pérdidas inmovilizado 671, ingresos excepcionales 778/771)
   - Nómina con SS e IRPF
   - Extracto bancario
   - Libro diario (asientos contables)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   │   └── src/
│   │       ├── lib/accounting-generator.ts  # AI generation logic
│   │       └── routes/accounting/index.ts   # API routes
│   └── contabilgen/        # React frontend
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/
│   │   └── src/schema/generations.ts  # Saved generations table
│   └── integrations-openai-ai-server/ # OpenAI AI integration
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — only emit `.d.ts` files during typecheck

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build`
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly`

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server.

- `POST /api/accounting/generate` — Generate accounting universe via AI
- `GET /api/accounting/generations` — List saved generations
- `POST /api/accounting/generations` — Save a generation
- `GET /api/accounting/generations/:id` — Get one generation
- `DELETE /api/accounting/generations/:id` — Delete generation

### `artifacts/contabilgen` (`@workspace/contabilgen`)

React + Vite frontend at path `/`.

- Config form to set generation parameters
- Tabbed viewer for all generated documents
- Sidebar with saved generation history
- Print/export functionality

### `lib/db` (`@workspace/db`)

- `src/schema/generations.ts` — Generations table with universeJson JSONB field

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec. Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/integrations-openai-ai-server` (`@workspace/integrations-openai-ai-server`)

OpenAI integration via Replit AI Integrations. Uses gpt-5.2 model.
Environment variables: `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`

## Authentication

Custom email/password auth (no Replit Auth):
- Registration, login, logout, forgot-password, reset-password
- Sessions: `sessions` table, cookie `sid`, 7-day TTL
- Password reset tokens: sha256 hash, 1-hour TTL, table `password_reset_tokens`
- Auth lib: `artifacts/api-server/src/lib/auth.ts`
- Email lib: `artifacts/api-server/src/lib/email.ts` — uses Resend SDK
  - **NOTE:** User dismissed the Resend integration. To enable real password-reset emails,
    provide a `RESEND_API_KEY` secret (from resend.com) and set `EMAIL_FROM` env var.
    Without it, the reset link is logged to the API server console only.

## Logo & Favicon

- Logo file: `artifacts/contabilgen/public/logo.png` (CG blue logo)
- Used in: login, register, forgot-password, reset-password pages; sidebar; loading screen
- Favicon: `<link rel="icon" type="image/png" href="/logo.png" />` in index.html

## Database

- Development: `pnpm --filter @workspace/db run push`
- Tables: `users`, `sessions`, `password_reset_tokens`, `settings`, `generations`

## Self-Hosted Deployment (Ubuntu)

- **Installer**: `install.sh` in repo root — unattended installer for Ubuntu 22.04/24.04/25.04
- **GitHub**: https://github.com/innovafpiesmmg/ContabilGen-Pro
- **Services**: `contabilgen-api` (systemd), Nginx (reverse proxy serving frontend static + API proxy)
- **Config**: `/etc/contabilgen/env` — persisted across updates; credentials auto-generated on first install
- **Cookies**: `SECURE_COOKIES` env var controls `secure` flag on session cookies (default: `false` for HTTP, `true` when Cloudflare Tunnel is configured)
- **Ports**: API on 5001 (internal), Nginx on 80 (public)
- **Update**: Re-run `sudo bash /var/www/contabilgen/install.sh` — detects existing install, preserves DB + credentials
