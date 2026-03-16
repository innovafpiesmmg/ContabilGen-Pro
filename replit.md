# ContabilGen Pro

## Overview

ContabilGen Pro es un generador de universos contables con IA para prácticas de Grado Medio y Superior de Contabilidad (FP). Soporta DeepSeek y OpenAI como proveedores de IA seleccionables. Genera ecosistemas contables coherentes con documentos reales del Plan General Contable español. Instalable como aplicación (PWA).

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS (artifacts/contabilgen)
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **AI**: DeepSeek (deepseek-chat) u OpenAI (gpt-4.1-mini) — seleccionable por usuario
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec) — CAUTION: `generateAccountingUniverse` in `lib/api-client-react/src/generated/api.ts` has CUSTOM polling logic (jobId → poll status). Must be re-applied after every `orval` regeneration.
- **Build**: esbuild (CJS bundle)

## Features

1. **Configuración**: Régimen fiscal (IVA/IGIC), Sector económico + Actividad (sub-sector), Año fiscal, Nombre empresa (opcional)
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
   - Siniestro (cuentas 671 pérdida inmovilizado / 440 deudores aseguradora / 778 ingreso excepcional)
   - Gastos e ingresos extraordinarios (multas 678, donaciones, pérdidas inmovilizado 671, ingresos excepcionales 778/771)
   - Nómina con SS e IRPF
   - Extracto bancario (construido determinísticamente desde operaciones reales — NO generado por IA)
   - Notas de adeudo bancario (construidas desde operaciones reales)
   - Recibos de cobro/pago (construidos desde facturas reales)
   - Facturas de servicios (alquiler, electricidad, agua, teléfono, internet, gestoría)
   - Cuadro de subcuentas (5-8 dígitos, asignación automática)
   - Libro diario — **100% determinista** desde documentos reales: cada factura genera asiento de compra/venta + cobro/pago; nóminas generan devengo + pago neto + TC1; liquidaciones IVA/IGIC con pago; cuotas préstamo/hipoteca con reclasificación; seguros, amortizaciones, póliza de crédito, tarjeta, extraordinarios, capital, apertura, dividendos. No usa IA para el diario. Subcuentas (N dígitos) aplicadas automáticamente.
   - **Cierre de ejercicio** (todo determinístico desde el diario):
     - Libro Mayor (todas las cuentas con movimientos, sumas y saldos)
     - Balance de Comprobación de Sumas y Saldos
     - Asientos de regularización (cierre grupos 6 y 7 → cuenta 129)
     - Cuenta de Pérdidas y Ganancias (desglose por naturaleza PGC)
     - Balance de Situación Final (Activo / PN+Pasivo)
     - Asiento de Cierre (todos los saldos a cero)

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

- Logo file: `artifacts/contabilgen/public/logo.png` (CG blue logo, 2000x2000)
- Used in: login, register, forgot-password, reset-password pages; sidebar; loading screen
- Favicon: `<link rel="icon" type="image/png" href="/logo.png" />` in index.html
- PWA icons: `icon-192x192.png`, `icon-512x512.png`, `apple-touch-icon.png` (auto-generated from logo)

## PWA (Progressive Web App)

- **Manifest**: `artifacts/contabilgen/public/manifest.json` — name, icons, colors, standalone mode
- **Service Worker**: `artifacts/contabilgen/public/sw.js` — network-first caching, offline fallback for visited pages
- **Registration**: `artifacts/contabilgen/src/main.tsx` — registers SW on load
- **Meta tags**: `index.html` includes `theme-color`, `apple-mobile-web-app-capable`, `apple-touch-icon`
- **Installation**: Requires HTTPS (works after deployment). Chrome/Edge show install icon; iOS via Share → "Add to Home Screen"
- **Cache strategy**: Network-first for all GET requests; API calls (`/api/`) are never cached

## Database

- Development: `pnpm --filter @workspace/db run push`
- Tables: `users`, `sessions`, `password_reset_tokens`, `settings`, `generations`

## PGC Loan Accounting (Préstamos LP/CP)

Per plangeneralcontable.com, loans use accounts 170 (LP) and 5200 (CP):
- **Formalización**: DEBE 572, HABER 170 (LP portion) + 5200 (CP portion = capital due within 12 months)
- **Pago cuota**: DEBE 5200 (capital) + 662 (intereses), HABER 572
- **Reclasificación 31/12**: DEBE 170, HABER 5200 (move next year's capital from LP to CP)
- Amortization tables are computed server-side (French system), not by AI
- Same treatment for mortgages (hipotecas)
- Types: `DebtClassification`, `ReclassificationInfo`, `SubEntry` in `bankLoan.ts`
- **Póliza de crédito**: 5201 (dispuesto), 662 (intereses), 626 (comisiones). NO usar 663 (no existe en PGC)
- **Tarjeta de crédito**: gastos → 410 (Acreedores por prestaciones de servicios). NO usar 523 (solo para inmovilizado)
- **Retribución administradores**: 640 (Sueldos y salarios). NO usar 651 (no existe en PGC)
- **Siniestro**: 671 (pérdida inmovilizado) + 440 (Deudores varios). NO usar 678 ni 430

## PDF Color Coding by Document Type

PDFs use color-coded headers/tables/totals to visually distinguish document categories:
- **Comercial** (facturas): verde `[34, 120, 74]`
- **Bancario** (extractos, tarjeta, notas cargo): azul `[41, 65, 122]`
- **Laboral** (nóminas, TC1 SS): naranja `[180, 95, 20]`
- **Fiscal** (liquidaciones IVA/IRPF/IS): rojo `[160, 45, 45]`
- **Financiación** (préstamo, hipoteca, póliza crédito): morado `[90, 50, 130]`
- **Seguros** (póliza seguro, siniestro): teal `[20, 115, 130]`
- **Patrimonio** (socios, dividendos, balance, cta socios): dorado `[140, 100, 30]`
- **Inmovilizado** (fichas activo): gris azulado `[70, 90, 110]`
- **Almacén** (fichas almacén): verde oliva `[85, 110, 50]`
- **Libro Diario**: azul marino `[25, 50, 95]`
- **Extraordinario** (multas, donaciones, etc.): naranja rojizo `[185, 70, 40]`

Implementation: `setDocColor(category)` sets `_activeColor` used by `headerBlock()`, `tableHeader()`, `sectionTitle()`, and summary boxes.

## Self-Hosted Deployment (Ubuntu)

- **Installer**: `install.sh` in repo root — unattended installer for Ubuntu 22.04/24.04/25.04
- **GitHub**: https://github.com/innovafpiesmmg/ContabilGen-Pro
- **Services**: `contabilgen-api` (systemd), Nginx (reverse proxy serving frontend static + API proxy)
- **Config**: `/etc/contabilgen/env` — persisted across updates; credentials auto-generated on first install
- **Cookies**: `SECURE_COOKIES` env var controls `secure` flag on session cookies (default: `false` for HTTP, `true` when Cloudflare Tunnel is configured)
- **Ports**: API on 5001 (internal), Nginx on 80 (public)
- **Update**: Re-run `sudo bash /var/www/contabilgen/install.sh` — detects existing install, preserves DB + credentials

## Zod Schemas (Critical Manual Updates)

The `universeJson` object is defined in **3 separate Zod schemas** in `lib/api-zod/src/generated/api.ts`:
1. `GenerateAccountingUniverseResponse` (line ~1107) — API response from generation
2. `SaveGenerationBody` (line ~1957) — saving to database
3. `GetGenerationResponse` (line ~2797) — loading from database

**All three must include every field** (`subAccounts`, `accountDigits`, `yearEndClosing`, etc.) or Zod will silently strip missing fields during validation, causing data loss on save.

Similarly, `lib/api-client-react/src/generated/api.schemas.ts` has `AccountingUniverse` interface used by both `SaveGenerationRequest` and `GenerationDetail`.

## Error Handling

- All async Express routes wrapped with `wrap()` helper → errors are caught and forwarded to the global error middleware
- Global error middleware in `app.ts` returns `{ error: "..." }` JSON with 500 status and logs the stack trace
- `process.on("uncaughtException")` and `process.on("unhandledRejection")` log the error and exit(1) so systemd can restart the service
- `authMiddleware` has try/catch: if DB is down, treats request as unauthenticated (does not crash)
- `forgot-password` route catches email send failures silently (security pattern: don't reveal if email exists)
