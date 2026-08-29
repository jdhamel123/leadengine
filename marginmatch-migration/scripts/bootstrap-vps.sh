#!/bin/bash
set -euo pipefail

if [ "${EUID}" -ne 0 ]; then
  echo "Run with sudo: sudo bash scripts/bootstrap-vps.sh" >&2
  exit 1
fi

INSTALL_DIR="${MARGINMATCH_INSTALL_DIR:-/opt/marginmatch}"
REPO_URL="${MARGINMATCH_REPO_URL:-https://github.com/jdhamel123/leadengine.git}"
BRANCH="${MARGINMATCH_BRANCH:-marginmatch-migration}"

echo "=== MarginMatch Portable VPS Bootstrap ==="
echo "Install directory: $INSTALL_DIR"
echo "Branch: $BRANCH"

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl git openssl ufw

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

systemctl enable --now docker

if ! docker compose version >/dev/null 2>&1; then
  apt-get install -y docker-compose-plugin
fi

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp
ufw --force enable

if [ -d "$INSTALL_DIR/.git" ]; then
  git -C "$INSTALL_DIR" fetch origin "$BRANCH"
  git -C "$INSTALL_DIR" checkout "$BRANCH"
  git -C "$INSTALL_DIR" reset --hard "origin/$BRANCH"
else
  rm -rf "$INSTALL_DIR"
  git clone --branch "$BRANCH" --single-branch "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR/marginmatch-migration"

randhex(){ openssl rand -hex "$1"; }

ENV_FILE=".env"
if [ ! -f "$ENV_FILE" ]; then
  ADMIN_EMAIL="${ADMIN_EMAIL:-}"
  PUBLIC_DOMAIN_VALUE="${PUBLIC_DOMAIN:-}"
  ACME_EMAIL_VALUE="${ACME_EMAIL:-$ADMIN_EMAIL}"

  if [ -z "$ADMIN_EMAIL" ]; then
    read -r -p "Owner/admin email: " ADMIN_EMAIL
  fi
  if [ -z "$PUBLIC_DOMAIN_VALUE" ]; then
    read -r -p "Public domain (or press Enter to use server IP testing): " PUBLIC_DOMAIN_VALUE
  fi
  if [ -z "$ACME_EMAIL_VALUE" ]; then
    ACME_EMAIL_VALUE="$ADMIN_EMAIL"
  fi

  if [ -z "$PUBLIC_DOMAIN_VALUE" ]; then
    PUBLIC_DOMAIN_VALUE="localhost"
  fi

  POSTGRES_PASSWORD_VALUE="$(randhex 24)"
  MINIO_ROOT_USER_VALUE="marginmatch-storage"
  MINIO_ROOT_PASSWORD_VALUE="$(randhex 24)"
  PORTABLE_ADMIN_ACCESS_KEY_VALUE="$(randhex 24)"
  PORTABLE_SESSION_SECRET_VALUE="$(randhex 32)"

  cat > "$ENV_FILE" <<EOF
POSTGRES_PASSWORD=$POSTGRES_PASSWORD_VALUE
MINIO_ROOT_USER=$MINIO_ROOT_USER_VALUE
MINIO_ROOT_PASSWORD=$MINIO_ROOT_PASSWORD_VALUE
PORTABLE_ADMIN_ACCESS_KEY=$PORTABLE_ADMIN_ACCESS_KEY_VALUE
PORTABLE_SESSION_SECRET=$PORTABLE_SESSION_SECRET_VALUE
ADMIN_EMAIL_ALLOWLIST=$ADMIN_EMAIL
SCHEDULED_ADMIN_EMAIL=$ADMIN_EMAIL
PUBLIC_DOMAIN=$PUBLIC_DOMAIN_VALUE
ACME_EMAIL=$ACME_EMAIL_VALUE
PORTABLE_PUBLIC_URL=http://localhost:3000
BACKUP_RETENTION_DAYS=14

# Migration safety locks
ENABLE_OUTBOUND_TEST_EMAILS=false
ENABLE_OUTBOUND_TEST_SMS=false
ENABLE_LEGACY_PORTABLE_ROUTES=false
ENABLE_LEGACY_EXTERNAL_MESSAGING=false
ENABLE_LEGACY_LIVE_PAYMENTS=false
VITE_ENABLE_LEGACY_PORTFOLIO=false
LEGACY_PORTFOLIO_PARITY_APPROVED=false

# Add securely after first boot as needed
STRIPE_RESTRICTED_KEY=
RESEND_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
OPENAI_API_KEY=
EOF
  chmod 600 "$ENV_FILE"

  install -d -m 700 /root/.marginmatch
  cat > /root/.marginmatch/owner-access.txt <<EOF
Owner email: $ADMIN_EMAIL
Portable admin access key: $PORTABLE_ADMIN_ACCESS_KEY_VALUE
Created: $(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF
  chmod 600 /root/.marginmatch/owner-access.txt

  echo
  echo "IMPORTANT: The generated owner access key was saved only on this VPS at:"
  echo "  /root/.marginmatch/owner-access.txt"
  echo "Do not paste that key into chat or source control."
fi

echo "Building and starting the portable stack..."
docker compose --env-file "$ENV_FILE" up -d --build

echo "Waiting for app health..."
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    echo "MarginMatch Portable is healthy."
    echo "Seeding Profit Factory portfolio..."
    docker compose exec -T app npm run profit-factory:seed || echo "Profit Factory seed deferred; it can be rerun after database initialization."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "App did not become healthy in time." >&2
    docker compose ps
    docker compose logs --tail=120 app
    exit 20
  fi
  sleep 5
done

SERVER_IP="$(curl -fsS https://api.ipify.org || hostname -I | awk '{print $1}')"

echo
echo "=== Bootstrap complete ==="
echo "Temporary app URL: http://$SERVER_IP:3000/"
echo "Owner login:       http://$SERVER_IP:3000/#portable-login"
echo "Migration control: http://$SERVER_IP:3000/#migration"
echo "Health endpoint:   http://$SERVER_IP:3000/api/health"
echo
echo "Next:"
echo "1. Open the owner login URL."
echo "2. Read the owner access key locally with:"
echo "   sudo cat /root/.marginmatch/owner-access.txt"
echo "3. Add Stripe/Resend/OpenAI credentials directly to $INSTALL_DIR/marginmatch-migration/.env — never paste them into chat."
echo "4. Point a test/domain DNS record to $SERVER_IP, then set PUBLIC_DOMAIN and PORTABLE_PUBLIC_URL to the HTTPS domain."
