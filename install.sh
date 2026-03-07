#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_status()  { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[OK]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[AVISO]${NC} $1"; }
print_error()   { echo -e "${RED}[ERROR]${NC} $1"; }
print_header()  { echo -e "\n${CYAN}═══════════════════════════════════════════${NC}"; echo -e "${CYAN}  $1${NC}"; echo -e "${CYAN}═══════════════════════════════════════════${NC}\n"; }

APP_NAME="safeexit"
APP_DIR="/var/www/$APP_NAME"
CONFIG_DIR="/etc/$APP_NAME"
APP_PORT="5000"
APP_USER="safeexit"
DB_NAME="safeexit"
DB_USER="safeexit"
GITHUB_REPO="https://github.com/innovafpiesmmg/SafeExit.git"

if [ "$EUID" -ne 0 ]; then
    print_error "Este script debe ejecutarse como root (sudo bash install.sh)"
    exit 1
fi

print_header "SafeExit - Instalador Automatizado"
echo -e "  Sistema de Control de Salida Escolar"
echo -e "  Repositorio: ${CYAN}$GITHUB_REPO${NC}"
echo ""

IS_UPDATE=false
if [ -f "$CONFIG_DIR/env" ]; then
    IS_UPDATE=true
    print_warning "Instalación existente detectada. Se realizará una ACTUALIZACIÓN."
    print_status "Las credenciales y la base de datos se conservarán."
    source "$CONFIG_DIR/env"
    echo ""
fi

if [ "$IS_UPDATE" = false ]; then
    print_header "Configuración del Administrador"
    read -p "  Usuario administrador [admin]: " ADMIN_USER
    ADMIN_USER=${ADMIN_USER:-admin}
    
    while true; do
        read -s -p "  Contraseña administrador: " ADMIN_PASS
        echo ""
        if [ ${#ADMIN_PASS} -lt 4 ]; then
            print_error "La contraseña debe tener al menos 4 caracteres"
            continue
        fi
        read -s -p "  Confirmar contraseña: " ADMIN_PASS2
        echo ""
        if [ "$ADMIN_PASS" != "$ADMIN_PASS2" ]; then
            print_error "Las contraseñas no coinciden"
            continue
        fi
        break
    done
    
    read -p "  Nombre completo del administrador [Administrador]: " ADMIN_NAME
    ADMIN_NAME=${ADMIN_NAME:-Administrador}
    echo ""
fi

print_header "1/9 - Actualizando sistema operativo"
print_status "Actualizando repositorios y paquetes del sistema..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"
print_success "Sistema actualizado"

print_header "2/9 - Instalando dependencias del sistema"
print_status "Instalando paquetes necesarios..."
apt-get install -y -qq curl git build-essential nginx postgresql postgresql-contrib ca-certificates gnupg lsb-release
apt-mark manual nginx postgresql postgresql-contrib build-essential
print_success "Dependencias del sistema instaladas"

print_header "3/9 - Instalando Node.js 20.x"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    print_status "Node.js ya instalado: $NODE_VERSION"
    if [[ ! "$NODE_VERSION" =~ ^v2[0-9] ]]; then
        print_warning "Versión antigua detectada, actualizando..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y -qq nodejs
    fi
else
    print_status "Instalando Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
fi
chmod 755 /usr/bin/node /usr/bin/npm 2>/dev/null || true
print_success "Node.js $(node -v) instalado"

print_header "4/9 - Configurando PostgreSQL"
systemctl enable postgresql
systemctl start postgresql

if [ "$IS_UPDATE" = false ]; then
    DB_PASS=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
    SESSION_SECRET=$(openssl rand -base64 32)
    
    sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || \
        sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
    
    sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
        sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
    
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
    
    PG_HBA=$(sudo -u postgres psql -t -c "SHOW hba_file;" | xargs)
    if ! grep -q "$DB_USER" "$PG_HBA" 2>/dev/null; then
        sed -i "/^# IPv4 local connections:/a host    $DB_NAME    $DB_USER    127.0.0.1/32    md5" "$PG_HBA"
        sed -i "/^# IPv6 local connections:/a host    $DB_NAME    $DB_USER    ::1/128         md5" "$PG_HBA"
        systemctl reload postgresql
    fi
    
    print_success "Base de datos '$DB_NAME' y usuario '$DB_USER' creados"
else
    print_status "Base de datos existente conservada"
fi

print_header "5/9 - Configurando usuario del sistema"
id "$APP_USER" &>/dev/null || useradd --system --create-home --shell /bin/bash "$APP_USER"
print_success "Usuario '$APP_USER' configurado"

print_header "6/9 - Descargando aplicación"
git config --global --add safe.directory "$APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
    print_status "Actualizando código desde GitHub..."
    cd "$APP_DIR"
    git checkout -- . 2>/dev/null || true
    git clean -fd 2>/dev/null || true
    sudo -u "$APP_USER" git pull origin main || git pull origin main
else
    print_status "Clonando repositorio..."
    git clone --depth 1 "$GITHUB_REPO" "$APP_DIR"
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
print_success "Código descargado en $APP_DIR"

mkdir -p "$APP_DIR/uploads"
chown "$APP_USER:$APP_USER" "$APP_DIR/uploads"

print_header "7/9 - Compilando aplicación"
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"

mkdir -p "$CONFIG_DIR"
if [ "$IS_UPDATE" = false ]; then
    cat > "$CONFIG_DIR/env" << ENVEOF
NODE_ENV=production
PORT=$APP_PORT
DATABASE_URL=$DATABASE_URL
SESSION_SECRET=$SESSION_SECRET
SECURE_COOKIES=false
ADMIN_USER=$ADMIN_USER
ADMIN_PASS=$ADMIN_PASS
ADMIN_NAME=$ADMIN_NAME
ENVEOF
else
    sed -i "s|^NODE_ENV=.*|NODE_ENV=production|" "$CONFIG_DIR/env"
    sed -i "s|^PORT=.*|PORT=$APP_PORT|" "$CONFIG_DIR/env"
fi
chmod 600 "$CONFIG_DIR/env"
chown root:root "$CONFIG_DIR/env"

print_status "Instalando dependencias npm..."
cd "$APP_DIR"
sudo -u "$APP_USER" bash -c "source $CONFIG_DIR/env 2>/dev/null; cd $APP_DIR && npm install --legacy-peer-deps 2>&1" | tail -3

print_status "Compilando frontend y backend..."
sudo -u "$APP_USER" bash -c "export $(grep -v '^#' $CONFIG_DIR/env | xargs); cd $APP_DIR && npm run build 2>&1" | tail -5

print_status "Ejecutando migraciones de base de datos..."
sudo -u "$APP_USER" bash -c "export $(grep -v '^#' $CONFIG_DIR/env | xargs); cd $APP_DIR && npx drizzle-kit push --force 2>&1" | tail -3
print_success "Aplicación compilada"

print_header "8/9 - Configurando DNS local (safeexit.local)"
print_status "Instalando dnsmasq para resolución de nombre local..."
apt-get install -y -qq dnsmasq || true

SERVER_IP=$(hostname -I | awk '{print $1}')

DNSMASQ_CONF="/etc/dnsmasq.d/safeexit.conf"
cat > "$DNSMASQ_CONF" << DNSEOF
address=/safeexit.local/$SERVER_IP
DNSEOF

if grep -q "^dns=dnsmasq" /etc/NetworkManager/NetworkManager.conf 2>/dev/null; then
    print_status "NetworkManager usa dnsmasq, configurando integración..."
    systemctl restart NetworkManager 2>/dev/null || true
else
    systemctl enable dnsmasq 2>/dev/null || true
    systemctl restart dnsmasq 2>/dev/null || true
fi

if ! grep -q "safeexit.local" /etc/hosts 2>/dev/null; then
    echo "$SERVER_IP  safeexit.local" >> /etc/hosts
fi

print_success "DNS local configurado: safeexit.local -> $SERVER_IP"
print_status "Los dispositivos de la red deben usar este servidor como DNS"
print_status "o configurar su router para apuntar DNS a $SERVER_IP"

print_header "9/9 - Configurando servicios"

cat > "/etc/systemd/system/$APP_NAME.service" << SVCEOF
[Unit]
Description=SafeExit - Control de Salida Escolar
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$CONFIG_DIR/env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable "$APP_NAME"
systemctl restart "$APP_NAME"
print_success "Servicio $APP_NAME configurado y arrancado"

cat > "/etc/nginx/sites-available/$APP_NAME" << NGXEOF
server {
    listen 80;
    server_name safeexit.local _;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGXEOF

ln -sf "/etc/nginx/sites-available/$APP_NAME" /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t 2>/dev/null && systemctl restart nginx
print_success "Nginx configurado como proxy inverso"

echo ""
read -p "Token de Cloudflare Tunnel (Enter para omitir): " CF_TOKEN
if [ -n "$CF_TOKEN" ]; then
    print_status "Instalando Cloudflare Tunnel..."
    ARCH=$(dpkg --print-architecture)
    curl -L -o /tmp/cloudflared.deb "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}.deb"
    dpkg -i /tmp/cloudflared.deb
    rm -f /tmp/cloudflared.deb
    
    cloudflared service install "$CF_TOKEN" 2>/dev/null || true
    systemctl enable cloudflared
    systemctl start cloudflared
    
    sed -i 's/SECURE_COOKIES=false/SECURE_COOKIES=true/' "$CONFIG_DIR/env"
    systemctl restart "$APP_NAME"
    print_success "Cloudflare Tunnel configurado (cookies seguras activadas)"
fi

sleep 3

SERVER_IP=$(hostname -I | awk '{print $1}')
echo ""
print_header "INSTALACIÓN COMPLETADA"
echo -e "  ${GREEN}SafeExit está funcionando correctamente${NC}"
echo ""
echo -e "  ${CYAN}URL de acceso:${NC}  http://safeexit.local"
echo -e "  ${CYAN}URL alternativa:${NC}  http://$SERVER_IP"
if [ "$IS_UPDATE" = false ]; then
echo -e "  ${CYAN}Usuario admin:${NC}  $ADMIN_USER"
echo -e "  ${CYAN}Contraseña:${NC}     (la que introdujiste)"
fi
echo ""
echo -e "  ${YELLOW}DNS local:${NC}"
echo -e "    dnsmasq resuelve ${CYAN}safeexit.local${NC} -> ${CYAN}$SERVER_IP${NC}"
echo -e "    Para que funcione, configura el DNS del router"
echo -e "    apuntando a ${CYAN}$SERVER_IP${NC}, o usa la IP directamente."
echo ""
echo -e "  ${YELLOW}Comandos útiles:${NC}"
echo -e "    Estado:      ${CYAN}systemctl status $APP_NAME${NC}"
echo -e "    Logs:        ${CYAN}journalctl -u $APP_NAME -f${NC}"
echo -e "    Reiniciar:   ${CYAN}systemctl restart $APP_NAME${NC}"
echo -e "    Actualizar:  ${CYAN}cd $APP_DIR && sudo bash install.sh${NC}"
echo ""
echo -e "  ${YELLOW}Configuración:${NC}  $CONFIG_DIR/env"
echo -e "  ${YELLOW}Aplicación:${NC}     $APP_DIR"
echo ""
