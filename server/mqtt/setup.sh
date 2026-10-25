#!/usr/bin/env bash
# Ставит брокер лобби на чистый Ubuntu 24.04: sudo bash setup.sh potenceval.ru
set -euo pipefail
DOMAIN=${1:?укажи домен: sudo bash setup.sh potenceval.ru}
cd "$(dirname "$0")"

apt-get update
apt-get install -y mosquitto caddy ufw

install -m 644 mosquitto.conf /etc/mosquitto/mosquitto.conf
install -m 644 potenceval.acl /etc/mosquitto/potenceval.acl
install -m 644 Caddyfile /etc/caddy/Caddyfile
mkdir -p /etc/systemd/system/caddy.service.d
printf '[Service]\nEnvironment=DOMAIN=%s\n' "$DOMAIN" > /etc/systemd/system/caddy.service.d/domain.conf

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

systemctl daemon-reload
systemctl enable --now mosquitto caddy
systemctl restart mosquitto caddy

echo "Готово. Проверка: откройте https://mqtt.$DOMAIN/ — ответ 400/426 значит, что брокер жив."
echo "В shared/net.js впишите: const OWN = 'wss://mqtt.$DOMAIN/mqtt';"
