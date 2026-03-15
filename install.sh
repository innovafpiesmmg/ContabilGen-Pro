#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

print_status()  { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[  OK]${NC} $1"; }
print_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_error()   { echo -e "${RED}[ERROR]${NC} $1"; }
print_step()    { echo -e "\n${CYAN}${BOLD}>>> $1${NC}"; }

APP_NAME="contabilgen"
APP_DIR="/var/www/$APP_NAME"
CONFIG_DIR="/etc/$APP_NAME"
APP_PORT="5000"
API_PORT="5001"
APP_USER="contabilgen"
DB_NAME="contabilgen"
DB_USER="contabilgen"
GITHUB_REPO="https://github.com/innovafpiesmmg/ContabilGen-Pro.git"
NODE_MAJOR=20

echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║        ContabilGen Pro — Instalador Automático          ║${NC}"
echo -e "${GREEN}${BOLD}║        Ubuntu 22.04 / 24.04 / 25.04                     ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$EUID" -ne 0 ]; then
    print_error "Este script debe ejecutarse como root (sudo bash install.sh)"
    exit 1
fi

IS_UPDATE=false
if [ -f "$CONFIG_DIR/env" ]; then
    IS_UPDATE=true
    print_warn "Instalación existente detectada — modo ACTUALIZACIÓN"
    print_status "Se preservarán las credenciales de $CONFIG_DIR/env"
    source "$CONFIG_DIR/env"
else
    print_status "Instalación nueva detectada"
fi

print_step "1/8 — Instalando dependencias del sistema"
apt-get update -qq
apt-get install -y -qq curl git build-essential nginx postgresql postgresql-contrib > /dev/null 2>&1
apt-mark manual nginx > /dev/null 2>&1
print_success "Dependencias del sistema instaladas"

print_step "2/8 — Instalando Node.js $NODE_MAJOR.x y pnpm"
if command -v node &> /dev/null; then
    CURRENT_NODE=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$CURRENT_NODE" -ge "$NODE_MAJOR" ]; then
        print_status "Node.js $(node -v) ya instalado"
    else
        print_status "Actualizando Node.js de v$CURRENT_NODE a v$NODE_MAJOR..."
        curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - > /dev/null 2>&1
        apt-get install -y -qq nodejs > /dev/null 2>&1
    fi
else
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - > /dev/null 2>&1
    apt-get install -y -qq nodejs > /dev/null 2>&1
fi
chmod 755 /usr/bin/node /usr/bin/npm 2>/dev/null || true

if ! command -v pnpm &> /dev/null; then
    npm install -g pnpm@latest > /dev/null 2>&1
fi
print_success "Node.js $(node -v) + pnpm $(pnpm -v)"

print_step "3/8 — Configurando PostgreSQL"
systemctl enable postgresql > /dev/null 2>&1
systemctl start postgresql

if [ "$IS_UPDATE" = false ]; then
    DB_PASS=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
    SESSION_SECRET=$(openssl rand -base64 32)

    sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || \
        sudo -u postgres psql -c "CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASS';" > /dev/null 2>&1
    sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
        sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" > /dev/null 2>&1
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" > /dev/null 2>&1

    print_success "Base de datos '$DB_NAME' creada con usuario '$DB_USER'"
else
    print_status "Base de datos existente — sin cambios"
    if ! grep -q "SECURE_COOKIES" "$CONFIG_DIR/env" 2>/dev/null; then
        echo "SECURE_COOKIES=false" >> "$CONFIG_DIR/env"
        print_status "Variable SECURE_COOKIES añadida a configuración existente"
    fi
fi

PG_HBA=$(sudo -u postgres psql -t -c "SHOW hba_file;" | tr -d ' ')
if [ -f "$PG_HBA" ]; then
    if ! grep -q "local.*${DB_NAME}.*${DB_USER}.*md5" "$PG_HBA" 2>/dev/null; then
        sed -i "/^local\s\+all\s\+all/i local   $DB_NAME   $DB_USER   md5" "$PG_HBA"
        systemctl restart postgresql
        print_status "Autenticación md5 configurada para $DB_USER"
    fi
fi

print_step "4/8 — Preparando usuario y directorios"
id "$APP_USER" &>/dev/null || useradd --system --create-home --shell /bin/bash "$APP_USER"
mkdir -p "$CONFIG_DIR"
mkdir -p "$APP_DIR"
chown root:"$APP_USER" "$CONFIG_DIR"
chmod 750 "$CONFIG_DIR"
print_success "Usuario '$APP_USER' y directorios listos"

print_step "5/8 — Descargando / actualizando código fuente"
git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true

if [ -d "$APP_DIR/.git" ]; then
    cd "$APP_DIR"
    git fetch --all --depth 1
    git reset --hard origin/master
    print_success "Código actualizado desde GitHub"
else
    rm -rf "$APP_DIR"
    git clone --depth 1 "$GITHUB_REPO" "$APP_DIR"
    print_success "Repositorio clonado"
fi

chown -R "$APP_USER:$APP_USER" "$APP_DIR"

print_step "6/8 — Instalando dependencias y compilando"

DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"

if [ "$IS_UPDATE" = false ]; then
    cat > "$CONFIG_DIR/env" << ENVEOF
NODE_ENV=production
PORT=$API_PORT
DATABASE_URL=$DATABASE_URL
SESSION_SECRET=$SESSION_SECRET
SECURE_COOKIES=false
ENVEOF
    chown root:"$APP_USER" "$CONFIG_DIR/env"
    chmod 640 "$CONFIG_DIR/env"
    print_success "Configuración guardada en $CONFIG_DIR/env"
else
    print_status "Configuración existente preservada"
fi

source "$CONFIG_DIR/env"
export DATABASE_URL PORT NODE_ENV

cd "$APP_DIR"

sudo -u "$APP_USER" bash -c "cd $APP_DIR && pnpm install --frozen-lockfile 2>/dev/null || pnpm install"
print_success "Dependencias instaladas"

sudo -u "$APP_USER" bash -c "cd $APP_DIR && PORT=3999 BASE_PATH=/ pnpm --filter @workspace/contabilgen run build"
print_success "Frontend compilado"

sudo -u "$APP_USER" bash -c "cd $APP_DIR && pnpm --filter @workspace/api-server run build"
print_success "API Server compilado"

print_status "Aplicando esquema de base de datos..."
sudo -u "$APP_USER" bash -c "set -a; source $CONFIG_DIR/env; set +a; cd $APP_DIR && pnpm --filter @workspace/db run push-force"
print_success "Base de datos sincronizada"

print_step "7/8 — Configurando servicios systemd"

cat > "/etc/systemd/system/${APP_NAME}-api.service" << SVCEOF
[Unit]
Description=ContabilGen Pro API Server
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR/artifacts/api-server
EnvironmentFile=$CONFIG_DIR/env
ExecStart=/usr/bin/node dist/index.cjs
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable "${APP_NAME}-api" > /dev/null 2>&1
systemctl restart "${APP_NAME}-api"
print_success "Servicio ${APP_NAME}-api configurado y arrancado"

print_step "8/8 — Configurando Nginx"

FRONTEND_DIR="$APP_DIR/artifacts/contabilgen/dist/public"

cat > "/etc/nginx/sites-available/$APP_NAME" << 'NGINXEOF'
server {
    listen 80;
    server_name _;
    client_max_body_size 100M;

    root FRONTEND_DIR_PLACEHOLDER;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:API_PORT_PLACEHOLDER;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
NGINXEOF

sed -i "s|FRONTEND_DIR_PLACEHOLDER|$FRONTEND_DIR|g" "/etc/nginx/sites-available/$APP_NAME"
sed -i "s|API_PORT_PLACEHOLDER|$API_PORT|g" "/etc/nginx/sites-available/$APP_NAME"

ln -sf "/etc/nginx/sites-available/$APP_NAME" /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t > /dev/null 2>&1
systemctl restart nginx
print_success "Nginx configurado como proxy inverso"

CF_TOKEN="${CF_TOKEN:-}"
if [ -z "$CF_TOKEN" ] && [ -t 0 ]; then
    echo ""
    echo -e "${YELLOW}┌──────────────────────────────────────────────────────┐${NC}"
    echo -e "${YELLOW}│  ¿Deseas configurar Cloudflare Tunnel? (HTTPS)      │${NC}"
    echo -e "${YELLOW}│  Si tienes un token de tunnel, introdúcelo ahora.   │${NC}"
    echo -e "${YELLOW}│  Pulsa Enter para omitir.                           │${NC}"
    echo -e "${YELLOW}└──────────────────────────────────────────────────────┘${NC}"
    read -p "Token de Cloudflare Tunnel: " CF_TOKEN
fi

if [ -n "$CF_TOKEN" ]; then
    print_status "Instalando Cloudflare Tunnel..."
    curl -L -o /tmp/cloudflared.deb \
        https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb 2>/dev/null
    dpkg -i /tmp/cloudflared.deb > /dev/null 2>&1
    rm -f /tmp/cloudflared.deb

    cloudflared service install "$CF_TOKEN" 2>/dev/null || true
    systemctl enable cloudflared > /dev/null 2>&1
    systemctl start cloudflared

    sed -i 's/SECURE_COOKIES=false/SECURE_COOKIES=true/' "$CONFIG_DIR/env"
    systemctl restart "${APP_NAME}-api"

    print_success "Cloudflare Tunnel configurado — cookies seguras activadas"
else
    print_status "Cloudflare Tunnel omitido — acceso HTTP directo"
fi

print_status "Verificando servicios..."
sleep 3
if systemctl is-active --quiet "${APP_NAME}-api"; then
    print_success "Servicio API activo"
else
    print_warn "El servicio API no arrancó correctamente. Revisa: journalctl -u ${APP_NAME}-api -n 30"
fi
if systemctl is-active --quiet nginx; then
    print_success "Nginx activo"
else
    print_warn "Nginx no está activo. Revisa: journalctl -u nginx -n 30"
fi

SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║          INSTALACIÓN COMPLETADA CON ÉXITO               ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}URL:${NC}            http://$SERVER_IP"
if [ -n "$CF_TOKEN" ]; then
echo -e "  ${BOLD}Tunnel:${NC}         Configurado (revisa tu dashboard de Cloudflare)"
fi
echo -e "  ${BOLD}Configuración:${NC}  $CONFIG_DIR/env"
echo ""
echo -e "  ${BOLD}Comandos útiles:${NC}"
echo -e "    Estado API:     ${CYAN}systemctl status ${APP_NAME}-api${NC}"
echo -e "    Logs API:       ${CYAN}journalctl -u ${APP_NAME}-api -f${NC}"
echo -e "    Reiniciar API:  ${CYAN}systemctl restart ${APP_NAME}-api${NC}"
echo -e "    Estado Nginx:   ${CYAN}systemctl status nginx${NC}"
echo -e "    Logs Nginx:     ${CYAN}tail -f /var/log/nginx/error.log${NC}"
echo -e "    Estado DB:      ${CYAN}systemctl status postgresql${NC}"
echo ""
echo -e "  ${BOLD}Para actualizar en el futuro:${NC}"
echo -e "    ${CYAN}sudo bash $APP_DIR/install.sh${NC}"
echo ""
if [ "$IS_UPDATE" = false ]; then
echo -e "  ${YELLOW}${BOLD}IMPORTANTE:${NC} Abre http://$SERVER_IP y registra tu usuario administrador."
echo -e "  ${YELLOW}Luego configura tu clave DeepSeek API en Ajustes.${NC}"
echo ""
fi
