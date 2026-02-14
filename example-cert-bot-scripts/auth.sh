#!/bin/sh
set -e

WEBHOOK_URL="http://<url-to-webhook>:<port>/present"

FQDN="_acme-challenge.${CERTBOT_DOMAIN}"
VALUE="${CERTBOT_VALIDATION}"

log "---------------------------------------------"
log "Starting DNS-01 auth hook"
log "FQDN  : ${FQDN}"
log "DOMAIN: ${CERTBOT_DOMAIN}"
log "VALUE : ${VALUE}"
echo "URL   : ${WEBHOOK_URL}"
log "---------------------------------------------"

curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"fqdn\": \"${FQDN}\",
    \"domain\": \"${CERTBOT_DOMAIN}\",
    \"value\": \"${VALUE}\"
  }"

log "Waiting for DNS propagation..."

for i in $(seq 1 $MAX_ATTEMPTS); do
  CURRENT=$(dig +short TXT "${FQDN}" | tr -d '"')

  log "Attempt $i/$MAX_ATTEMPTS"
  log "Expected: ${VALUE}"
  log "Found   : ${CURRENT:-<none>}"

  echo "$CURRENT_VALUES" | grep -Fxq "$VALUE" && {
    log "DNS propagated successfully."
    exit 0
  }

  sleep $SLEEP_SECONDS
done

log "DNS propagation failed after $((MAX_ATTEMPTS * SLEEP_SECONDS)) seconds."
exit 1
