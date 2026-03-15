<p align="center">
  <img src="artifacts/contabilgen/public/logo.png" alt="ContabilGen Pro" width="120" />
</p>

<h1 align="center">ContabilGen Pro</h1>

<p align="center">
  Generador de ejercicios contables por IA para Formación Profesional (Grado Medio y Superior)
</p>

---

## Qué es ContabilGen Pro

ContabilGen Pro es una aplicación web que genera **universos contables completos y coherentes** para prácticas de contabilidad en ciclos formativos de FP. Utiliza inteligencia artificial (DeepSeek) para crear documentos realistas basados en el **Plan General Contable (PGC)** español.

Cada generación produce un conjunto completo de documentos listos para imprimir o exportar como PDF/ZIP, simulando el ejercicio contable de una empresa real.

## Funcionalidades

### Configuración del ejercicio

- **Régimen fiscal**: IVA (Península/Baleares) o IGIC (Canarias)
- **Sector económico**: Comercio, Servicios, Industria, Hostelería
- **Actividad específica**: Más de 70 actividades por sector (agrícola, tecnología, hostelería, textil, etc.) que contextualizan productos, proveedores y documentos
- **Año fiscal** y **período personalizable** (trimestral, semestral, anual)
- **Nivel educativo**: Grado Medio o Superior
- **Nombre de empresa** (opcional — la IA inventa uno si no se indica)

### Módulos activables

| Módulo | Descripción |
|--------|-------------|
| Nóminas (IRPF + SS) | Recibos de salario con retenciones |
| TC1 Seguridad Social | Boletines de cotización mensuales |
| Impuestos (IVA/IS) | Liquidaciones trimestrales Mod.303/420 y Mod.200 |
| Préstamo bancario | Cuadro de amortización sistema francés |
| Hipoteca | Préstamo hipotecario con tabla de amortización |
| Póliza de crédito | Cuenta de crédito con liquidación de intereses |
| Inmovilizado | Activo fijo con dotación anual de amortización |
| Socios y capital | Estructura societaria, participaciones, tipo de sociedad |
| Balance de apertura | Asiento de apertura con activos, pasivos y patrimonio neto |
| C/C socios (551/553) | Anticipos, préstamos y retribuciones a socios |
| Reparto de dividendos | Dotación de reservas y pago con retención IRPF |

### Documentos generados

- Perfil de empresa con datos fiscales completos
- Listado de proveedores y clientes
- Inventario inicial y final (variación de existencias)
- Fichas de almacén con valoración PMP
- Facturas de compra y venta con asientos contables
- Cuadro de amortización de préstamos
- Liquidación de póliza de crédito
- Extracto de tarjeta de crédito
- Pólizas de seguros con periodificación (cuenta 480)
- Siniestros (cuentas 678/778)
- Gastos e ingresos extraordinarios (multas, donaciones, pérdidas)
- Nóminas con Seguridad Social e IRPF
- Extractos bancarios mensuales
- Libro diario completo
- Cronología de todos los eventos

### Exportación

- **PDF individual** por cada documento (facturas, nóminas, extractos, etc.)
- **ZIP cronológico** con todos los documentos ordenados por fecha
- Documentos con aspecto realista, listos para imprimir

---

## Instalación en Ubuntu

### Requisitos previos

- Ubuntu 22.04, 24.04 o 25.04
- Acceso root (sudo)
- Conexión a Internet
- Una clave API de [DeepSeek](https://platform.deepseek.com/)

### Paso 1 — Actualizar el sistema e instalar dependencias básicas

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl
```

### Paso 2 — Instalar la aplicación

Ejecuta el instalador automático con un solo comando:

```bash
curl -fsSL https://raw.githubusercontent.com/innovafpiesmmg/ContabilGen-Pro/main/install.sh | sudo bash
```

El instalador se encarga de todo automáticamente:

- Instala Node.js 20, pnpm, PostgreSQL y Nginx
- Crea la base de datos y el usuario del sistema
- Descarga el código fuente desde GitHub
- Compila el frontend y el backend
- Configura el servicio systemd y el proxy Nginx
- Genera credenciales seguras automáticamente

#### Instalación con Cloudflare Tunnel (HTTPS)

Si dispones de un token de Cloudflare Tunnel para acceso HTTPS:

```bash
curl -fsSL https://raw.githubusercontent.com/innovafpiesmmg/ContabilGen-Pro/main/install.sh | sudo CF_TOKEN="tu-token-aquí" bash
```

### Paso 3 — Configurar la aplicación

1. Abre tu navegador y accede a `http://IP-DE-TU-SERVIDOR`
2. Registra tu usuario administrador
3. Ve a **Ajustes** y configura tu clave API de DeepSeek

---

## Actualización

Para actualizar a la última versión, ejecuta el mismo comando de instalación:

```bash
curl -fsSL https://raw.githubusercontent.com/innovafpiesmmg/ContabilGen-Pro/main/install.sh | sudo bash
```

El instalador detecta automáticamente que ya existe una instalación previa y:

- Preserva la base de datos y las credenciales
- Descarga el código actualizado desde GitHub
- Recompila frontend y backend
- Reinicia los servicios

---

## Comandos útiles

| Acción | Comando |
|--------|---------|
| Estado del servicio | `sudo systemctl status contabilgen-api` |
| Ver logs en tiempo real | `sudo journalctl -u contabilgen-api -f` |
| Reiniciar la aplicación | `sudo systemctl restart contabilgen-api` |
| Estado de Nginx | `sudo systemctl status nginx` |
| Logs de Nginx | `sudo tail -f /var/log/nginx/error.log` |
| Estado de PostgreSQL | `sudo systemctl status postgresql` |
| Ver configuración | `sudo cat /etc/contabilgen/env` |

---

## Stack tecnológico

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Express 5 (Node.js)
- **Base de datos**: PostgreSQL + Drizzle ORM
- **IA**: DeepSeek (deepseek-chat)
- **PDF**: jsPDF
- **Gestión de paquetes**: pnpm (monorepo)
- **Proceso**: systemd
- **Proxy**: Nginx

---

## Licencia

Proyecto desarrollado para uso educativo en centros de Formación Profesional.
