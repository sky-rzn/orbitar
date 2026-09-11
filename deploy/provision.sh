#!/usr/bin/env bash
# Первичная настройка vps2 под orbitar.duckdns.org. Запускать от root, идемпотентно.
#
#   scp deploy/provision.sh deploy/nginx-orbitar.conf root@vps2:/tmp/
#   ssh root@vps2 'CI_DEPLOY_PUBKEY="ssh-ed25519 AAAA... " bash /tmp/provision.sh'
#
# Машина уже держит другие сайты, поэтому скрипт ничего не переустанавливает
# и не трогает чужие конфиги — только добавляет своё.
set -euo pipefail

DOMAIN=orbitar.duckdns.org
WEBROOT=/var/www/orbitar
ACME_ROOT=/var/www/acme
DEPLOY_USER=orbitar-deploy
CERT_EMAIL="${CERT_EMAIL:-alexandr.sky@gmail.com}"

for cmd in nginx certbot rsync; do
    command -v "$cmd" >/dev/null || { echo "нет $cmd — поставь и перезапусти" >&2; exit 1; }
done

echo "==> Пользователь $DEPLOY_USER"
if ! id -u "$DEPLOY_USER" >/dev/null 2>&1; then
    # Системная учётка без sudo и без пароля: умеет только принимать rsync
    # в свой webroot. Компрометация ключа CI не даёт прав на машине.
    useradd --system --create-home --shell /bin/bash "$DEPLOY_USER"
fi

install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
AUTH="/home/$DEPLOY_USER/.ssh/authorized_keys"
touch "$AUTH"
if [ -n "${CI_DEPLOY_PUBKEY:-}" ] && ! grep -qF "$CI_DEPLOY_PUBKEY" "$AUTH"; then
    echo "$CI_DEPLOY_PUBKEY" >> "$AUTH"
    echo "    добавлен ключ CI"
fi
chown "$DEPLOY_USER:$DEPLOY_USER" "$AUTH"
chmod 600 "$AUTH"

echo "==> Webroot $WEBROOT"
install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$WEBROOT"

echo "==> Сертификат Let's Encrypt"
if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    echo "    уже выпущен, пропускаем"
else
    # Выпускаем ДО установки vhost: его 443-блок ссылается на файлы
    # сертификата, и без них nginx не загрузится. http-01 challenge пока
    # отдаёт acme-bootstrap — он default_server и ловит чужие имена.
    certbot certonly --webroot -w "$ACME_ROOT" -d "$DOMAIN" \
            --key-type ecdsa --non-interactive --agree-tos --email "$CERT_EMAIL"
fi

echo "==> nginx vhost"
CONF_SRC="$(dirname "$(readlink -f "$0")")/nginx-orbitar.conf"
[ -f "$CONF_SRC" ] || CONF_SRC=/tmp/nginx-orbitar.conf
install -m 644 "$CONF_SRC" "/etc/nginx/sites-available/$DOMAIN"
ln -sfn "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"
nginx -t
systemctl reload nginx

echo "==> Готово: https://$DOMAIN"
