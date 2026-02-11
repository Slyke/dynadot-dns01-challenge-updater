const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const DYNADOT_API_KEY = process.env.DYNADOT_API_KEY || 'your-dynadot-api-key';
const ADD_DNS_TO_CURRENT_SETTING = process.env.ADD_DNS_TO_CURRENT_SETTING?.substring(0, 1) ?? '1';
const LOG_TXT_VALUES = process.env.LOG_TXT_VALUES === 'true';
const LOG_REQ_BODY = process.env.LOG_REQ_BODY === 'true';
const LOG_API_URL = process.env.LOG_API_URL === 'true';
const LOG_DYNAREQ_URL = process.env.LOG_DYNAREQ_URL === 'true';

let packageJson = null;
try {
  packageJson = require('./package.json');
} catch (error) {
  console.error('Error loading package.json:', error);
}

const logWithTimestamp = (message) => {
  const timestamp = new Date().toISOString().replace('T', ' ');
  console.log(`[${timestamp}]: ${message}`);
};

const fetchExistingRecords = async (domain, correlationId) => {
  const url = `https://api.dynadot.com/api3.json?key=${DYNADOT_API_KEY}&command=get_dns&domain=${domain}`;
  if (LOG_DYNAREQ_URL) {
    logWithTimestamp(`{${correlationId}} Fetching existing records from: ${url}`);
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch existing records. Status: ${response.status}`);
  }
  const data = await response.json();

  const ns =
    data?.GetDnsResponse?.GetDns?.NameServerSettings ??
    data?.Response?.GetDns?.NameServerSettings ??
    data?.GetDns?.NameServerSettings ??
    {};

  return {
    topDomain: Array.from(new Set((ns.MainDomains || []).map(JSON.stringify))).map(JSON.parse),
    subDomains: Array.from(new Set((ns.SubDomains || []).map(JSON.stringify))).map(JSON.parse)
  };
};

const makeRequest = async (url, correlationId) => {
  if (LOG_API_URL) {
    logWithTimestamp(`{${correlationId}} Making request to: ${url}`);
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  return response.text
};

const sanitizeDomain = (fqdn) => fqdn.replace(/[^a-zA-Z0-9.-_]/g, '');
const stripSubdomain = (fqdn) => fqdn.split('.').slice(-2).join('.');
const removeTrailingDot = (fqdn) => fqdn.endsWith('.') ? fqdn.slice(0, -1) : fqdn;

const updateOrAddRecord = (records, subhost, type, value) => {
  const existingIndex = records.findIndex(
    record => record.Subhost === subhost && record.RecordType.toLowerCase() === type
  );
  if (existingIndex !== -1) {
    records[existingIndex].Value = value;
  } else {
    records.push({ Subhost: subhost, RecordType: type, Value: value });
  }
};

const server = http.createServer(async (req, res) => {
  const correlationId = crypto.randomUUID();
  logWithTimestamp(`{${correlationId}} Received request: ${req.method} ${req.url}`);

  if (req.method !== 'POST' || !['/present', '/cleanup'].includes(req.url)) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    try {
      console.log('');
      console.log('-------------------------------------------------------------------------');
      console.log('');
      const { fqdn, domain, value } = JSON.parse(body);
      const cleanFqdn = removeTrailingDot(fqdn);
      const cleanDomain = sanitizeDomain(removeTrailingDot(domain));

      if (!cleanDomain) {
        throw new Error("Domain missing");
      }

      if (!cleanFqdn.endsWith(cleanDomain)) {
        throw new Error("FQDN does not match domain");
      }
      let subdomain = '';

      if (cleanFqdn.length > cleanDomain.length) {
        subdomain = cleanFqdn.slice(0, -(cleanDomain.length + 1));
      }

      if (LOG_REQ_BODY) {
        logWithTimestamp(`{${correlationId}} Incoming request body: ${body}`);
      }

      let existingRecords;
      try {
        existingRecords = await fetchExistingRecords(cleanDomain, correlationId);
      } catch (err) {
        logWithTimestamp(`{${correlationId}} Error fetching existing records: ${err.message}`);
        throw new Error("Aborting because existing DNS records could not be fetched");
      }
  
      logWithTimestamp(`{${correlationId}} Existing records count (subdomains): ${existingRecords.subDomains.length}`);
      logWithTimestamp(`{${correlationId}} Existing records count (top-level): ${existingRecords.topDomain.length}`);

      if (LOG_REQ_BODY) {
        logWithTimestamp(`{${correlationId}} Existing records: ${JSON.stringify(existingRecords)}`);
      }

      if (req.url === '/cleanup') {
        existingRecords.subDomains = existingRecords.subDomains.filter((record) => !(record.Subhost === subdomain
            && record.RecordType.toLowerCase() === 'txt'
            && record.Value === value)
          );
      } else {
        updateOrAddRecord(existingRecords.subDomains, subdomain, 'txt', value);
      }

      const apiUrl = new URL('https://api.dynadot.com/api3.json');
      apiUrl.searchParams.append('key', DYNADOT_API_KEY);
      apiUrl.searchParams.append('command', 'set_dns2');
      apiUrl.searchParams.append('domain', cleanDomain);

      existingRecords.topDomain.forEach((record, index) => {
        apiUrl.searchParams.append(`main_record_type${index}`, record.RecordType.toLowerCase());
        apiUrl.searchParams.append(`main_record${index}`, record.Value);
      });

      existingRecords.subDomains.forEach((record, index) => {
        apiUrl.searchParams.append(`subdomain${index}`, record.Subhost);
        apiUrl.searchParams.append(`sub_record_type${index}`, record.RecordType.toLowerCase());
        apiUrl.searchParams.append(`sub_record${index}`, record.Value);
      });

      if (LOG_REQ_BODY) {
        logWithTimestamp(`{${correlationId}} New records: ${JSON.stringify(existingRecords)}`);
      }

      await makeRequest(apiUrl, correlationId);

      logWithTimestamp(`{${correlationId}} TXT record ${req.url === '/present' ? 'added/updated' : 'removed'} successfully`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: `TXT record ${req.url === '/present' ? 'added/updated' : 'removed'}` }));
    } catch (error) {
      logWithTimestamp(`{${correlationId}} Error: ${error.message}`);
      res.writeHead(501, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to process request' }));
    } finally {
      console.log('');
      console.log('-------------------------------------------------------------------------');
      console.log('');
    }
  });
});

logWithTimestamp(`Dynadot DNS-01 Challenge Handler initialized.`);
logWithTimestamp(`Version: ${packageJson?.version || 'unknown'}`);
logWithTimestamp(`Dynadot API Key: ${DYNADOT_API_KEY ? '***' : 'Not set'}`);

server.listen(PORT, () => {
  logWithTimestamp(`Dynadot DNS-01 Challenge Handler running on port ${PORT}`);
});
