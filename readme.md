# Dynadot DNS-01 Challenge HTTP Handler

This script runs an HTTP server to handle DNS-01 challenges for ACME clients like Certbot. It accepts JSON `POST` requests to `/present` and `/cleanup` to add or remove DNS TXT records using the Dynadot API.

## Features

- Handles `/present` and `/cleanup` HTTP POST endpoints.
- Dynamically updates `_acme-challenge` TXT records for domain validation.
- Uses existing DNS records from Dynadot and preserves them when updating.
- Supports extensive logging for debugging and traceability.

## Requirements

- Node.js `18+`
- Dynadot API access enabled

## Environment Variables

Set the following environment variables to configure the handler:

| Variable                    | Description                                                                 |
|-----------------------------|-----------------------------------------------------------------------------|
| `PORT`                      | Port the server listens on (default: `3000`)                                |
| `DYNADOT_API_KEY`           | **(required)** Your Dynadot API key                                         |
| `ADD_DNS_TO_CURRENT_SETTING`| Whether to merge with existing DNS settings (default: `'1'`)                |
| `LOG_TXT_VALUES`            | Set to `true` to log TXT values                                             |
| `LOG_REQ_BODY`              | Set to `true` to log full request bodies                                    |
| `LOG_API_URL`               | Set to `true` to log Dynadot API URLs                                       |
| `LOG_DYNAREQ_URL`           | Set to `true` to log DNS fetch request URLs                                 |

## Usage

```bash
# Set environment variables
export DYNADOT_API_KEY="your-api-key"
export PORT=3000
export LOG_REQ_BODY=true
export LOG_API_URL=true
export LOG_DYNAREQ_URL=true

# Run the script
node index.js
```


Example DNS01 Challenge request body:
```
{
  "fqdn": "_acme-challenge.example.com.",
  "value": "challenge-token"
}
```


Docker update:

```
docker build -t dynadot-dns01-challenge-handler .

docker tag dynadot-dns01-challenge-handler DOMAIN.xyz/slyke/dynadot-dns01-challenge-handler:latest
docker tag dynadot-dns01-challenge-handler DOMAIN.xyz/slyke/dynadot-dns01-challenge-handler:v1.0.X
docker push DOMAIN.xyz/slyke/dynadot-dns01-challenge-handler:latest
docker push DOMAIN.xyz/slyke/dynadot-dns01-challenge-handler:v1.0.X
docker pull DOMAIN.xyz/slyke/dynadot-dns01-challenge-handler:latest



docker tag DOMAIN.xyz/dynadot-dns01-challenge-handler:latest IP:5000/dynadot-dns01-challenge-handler:latest
docker push IP:5000/dynadot-dns01-challenge-handler:latest


docker tag DOMAIN.xyz/dynadot-dns01-challenge-handler:latest DOMAIN.xyz/dynadot-dns01-challenge-handler:latest
docker push DOMAIN.xyz/dynadot-dns01-challenge-handler:latest
docker pull DOMAIN.xyz/dynadot-dns01-challenge-handler:latest
```