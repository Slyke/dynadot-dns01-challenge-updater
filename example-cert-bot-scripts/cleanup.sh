#!/bin/sh
set -e

WEBHOOK_URL="http://<url-to-your-certbot>:<port>/cleanup"

FQDN="_acme-challenge.${CERTBOT_DOMAIN}"
VALUE="${CERTBOT_VALIDATION}"

echo "Cleaning up DNS challenge for ${FQDN}"

curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"fqdn\": \"${FQDN}\",
    \"domain\": \"${CERTBOT_DOMAIN}\",
    \"value\": \"${VALUE}\"
  }"
