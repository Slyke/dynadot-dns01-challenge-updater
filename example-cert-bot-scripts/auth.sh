#!/bin/sh
set -e

WEBHOOK_URL="http://<url-to-webhook>:<port>/present"

FQDN="_acme-challenge.${CERTBOT_DOMAIN}"
VALUE="${CERTBOT_VALIDATION}"

echo "Presenting DNS challenge for ${FQDN}"

curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"fqdn\": \"${FQDN}\",
    \"domain\": \"${CERTBOT_DOMAIN}\",
    \"value\": \"${VALUE}\"
  }"

echo "Waiting for DNS propagation..."

for i in $(seq 1 30); do
  if dig +short TXT "${FQDN}" | grep -q "${VALUE}"; then
    echo "DNS propagated."
    exit 0
  fi
  sleep 5
done

echo "DNS propagation failed."
exit 1
