const http = require('https');

const req = http.request(
  'https://oura-r2-worker.sneppec97.workers.dev/r2-storage-stats',
  {
    headers: {
      'X-Auth-Token': 'oura!Secret2024'
    }
  },
  (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log('Status Code:', res.statusCode);
      console.log('Response Body:', data);
    });
  }
);

req.on('error', (e) => {
  console.error('Error:', e);
});

req.end();
