/**
 * Oura Standalone Worker – R2 Multipart Upload Support
 */

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return hashBuffer;
}

async function hmacSha256(key, message) {
  const gkey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', gkey, new TextEncoder().encode(message));
  return sig;
}

async function getSignatureKey(key, dateStamp, regionName, serviceName) {
  const kDate = await hmacSha256(new TextEncoder().encode('AWS4' + key), dateStamp);
  const kRegion = await hmacSha256(kDate, regionName);
  const kService = await hmacSha256(kRegion, serviceName);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  return kSigning;
}

async function signS3(env, method, path, queryParams = {}) {
  const datetime = new Date().toISOString().replace(/[:-]/g, '').replace(/\..+/, 'Z');
  const datestamp = datetime.slice(0, 8);
  const region = 'auto';
  const service = 's3';
  const host = `${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const credential = `${env.R2_ACCESS_KEY_ID}/${datestamp}/${region}/${service}/aws4_request`;
  const signedHeaders = 'host';

  const allParams = {
    ...queryParams,
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': datetime,
    'X-Amz-Expires': '3600',
    'X-Amz-SignedHeaders': signedHeaders
  };

  const sortedQuery = Object.keys(allParams).sort().map(k => `${k}=${encodeURIComponent(allParams[k])}`).join('&');
  const canonicalRequest = `${method}\n${path}\n${sortedQuery}\nhost:${host}\n\n${signedHeaders}\nUNSIGNED-PAYLOAD`;
  const hashedCanonicalRequest = Array.from(new Uint8Array(await sha256(canonicalRequest))).map(b => b.toString(16).padStart(2, '0')).join('');

  const stringToSign = `AWS4-HMAC-SHA256\n${datetime}\n${datestamp}/${region}/${service}/aws4_request\n${hashedCanonicalRequest}`;
  const signingKey = await getSignatureKey(env.R2_SECRET_ACCESS_KEY, datestamp, region, service);
  const signature = Array.from(new Uint8Array(await hmacSha256(signingKey, stringToSign))).map(b => b.toString(16).padStart(2, '0')).join('');

  return `https://${host}${path}?${sortedQuery}&X-Amz-Signature=${signature}`;
}

export default {
  async fetch(request, env) {
    const CORS = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    const path = url.pathname;
    const token = request.headers.get('X-Auth-Token');
    const BUCKET = env.R2_BUCKET_NAME || 'oura-videos';

    if (token !== env.AUTH_SECRET && path !== '/health') {
      return new Response('Unauthorized', { status: 401, headers: CORS });
    }

    try {
      if (request.method === 'POST' && path === '/multipart/create') {
        const { key } = await request.json();
        const s3Url = await signS3(env, 'POST', `/${BUCKET}/${key}`, { uploads: '' });
        const resp = await fetch(s3Url, { method: 'POST' });
        const text = await resp.text();
        const uploadId = text.match(/<UploadId>(.*)<\/UploadId>/)?.[1];
        if (!uploadId) throw new Error('Gagal inisialisasi Multipart: ' + text);
        return new Response(JSON.stringify({ uploadId, key }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      }

      if (request.method === 'POST' && path === '/multipart/sign-part') {
        const { key, uploadId, partNumber } = await request.json();
        const uploadUrl = await signS3(env, 'PUT', `/${BUCKET}/${key}`, { partNumber, uploadId });
        return new Response(JSON.stringify({ uploadUrl }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      }

      if (request.method === 'POST' && path === '/multipart/complete') {
        const { key, uploadId, parts } = await request.json();
        const s3Url = await signS3(env, 'POST', `/${BUCKET}/${key}`, { uploadId });
        const body = `<CompleteMultipartUpload>${parts.map(p => `<Part><PartNumber>${p.PartNumber}</PartNumber><ETag>${p.ETag}</ETag></Part>`).join('')}</CompleteMultipartUpload>`;
        const resp = await fetch(s3Url, { method: 'POST', body });
        return new Response(JSON.stringify({ success: resp.ok, publicUrl: `${env.R2_PUBLIC_URL}/${key}` }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      }

      if (request.method === 'POST' && path === '/presign') {
        const { key } = await request.json();
        const uploadUrl = await signS3(env, 'PUT', `/${BUCKET}/${key}`);
        return new Response(JSON.stringify({ uploadUrl, publicUrl: `${env.R2_PUBLIC_URL}/${key}` }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      }

      if (request.method === 'POST' && path === '/dood-remote') {
        const { apiKey, videoUrl } = await request.json();
        if (!apiKey || !videoUrl) {
          return new Response(JSON.stringify({ error: 'apiKey dan videoUrl wajib diisi' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
        }
        const doodUrl = `https://doodapi.com/api/upload/url?key=${apiKey}&url=${encodeURIComponent(videoUrl)}`;
        const doodResp = await fetch(doodUrl);
        const doodData = await doodResp.json();
        return new Response(JSON.stringify(doodData), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      }

      if (request.method === 'POST' && path === '/tg-to-dood') {
        const { botToken, fileId, doodApiKey } = await request.json();
        if (!botToken || !fileId || !doodApiKey) {
          return new Response(JSON.stringify({ error: 'botToken, fileId, dan doodApiKey wajib diisi' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
        }

        const tgResp = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
        const tgData = await tgResp.json();
        if (!tgData.ok) {
          return new Response(JSON.stringify({ error: 'Telegram API Error: ' + (tgData.description || 'Gagal ambil path') }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
        }

        const directUrl = `https://api.telegram.org/file/bot${botToken}/${tgData.result.file_path}`;
        const doodUrl = `https://doodapi.com/api/upload/url?key=${doodApiKey}&url=${encodeURIComponent(directUrl)}`;
        const doodResp = await fetch(doodUrl);
        const doodData = await doodResp.json();

        return new Response(JSON.stringify({ ...doodData, directUrl }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      }

      if (request.method === 'DELETE' && path === '/delete') {
        const { key } = await request.json();
        if (!key) throw new Error('Key is required');
        const s3Url = await signS3(env, 'DELETE', `/${BUCKET}/${key}`);
        const resp = await fetch(s3Url, { method: 'DELETE' });
        return new Response(JSON.stringify({ success: resp.ok }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      }

      if (request.method === 'GET' && path === '/r2-storage-stats') {
        const s3Url = await signS3(env, 'GET', '/');
        const resp = await fetch(s3Url);
        const text = await resp.text();

        if (!resp.ok) {
          const codeMatch = text.match(/<Code>([^<]+)<\/Code>/);
          const messageMatch = text.match(/<Message>([^<]+)<\/Message>/);
          const code = codeMatch ? codeMatch[1] : 'Unknown';
          const msg = messageMatch ? messageMatch[1] : 'S3 request failed';
          throw new Error(`S3 Error [${code}]: ${msg} (status ${resp.status})`);
        }

        const bucketRegex = /<Bucket><Name>([^<]+)<\/Name>/g;
        let match;
        const buckets = [];
        while ((match = bucketRegex.exec(text)) !== null) {
          buckets.push(match[1]);
        }

        const stats = [];
        for (const bucketName of buckets) {
          let continuationToken = null;
          let totalSize = 0;
          let objectCount = 0;
          let iterations = 0;
          
          try {
            do {
              const query = { 'list-type': '2' };
              if (continuationToken) {
                query['continuation-token'] = continuationToken;
              }
              const listUrl = await signS3(env, 'GET', `/${bucketName}`, query);
              const listResp = await fetch(listUrl);
              const listText = await listResp.text();
              
              const sizeRegex = /<Size>(\d+)<\/Size>/g;
              let sm;
              while ((sm = sizeRegex.exec(listText)) !== null) {
                totalSize += parseInt(sm[1], 10);
                objectCount++;
              }
              
              const isTruncatedMatch = listText.match(/<IsTruncated>(true|false)<\/IsTruncated>/);
              const isTruncated = isTruncatedMatch ? isTruncatedMatch[1] === 'true' : false;
              if (isTruncated) {
                const tokenMatch = listText.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
                continuationToken = tokenMatch ? tokenMatch[1] : null;
              } else {
                continuationToken = null;
              }
              iterations++;
            } while (continuationToken && iterations < 15);

            stats.push({
              bucket: bucketName,
              objects: objectCount,
              sizeBytes: totalSize
            });
          } catch (e) {
            stats.push({
              bucket: bucketName,
              objects: 0,
              sizeBytes: 0,
              error: e.message
            });
          }
        }

        return new Response(JSON.stringify({ buckets: stats }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      }

      if (request.method === 'GET' && path === '/list') {
        const prefix = url.searchParams.get('prefix') || '';
        const delimiter = url.searchParams.get('delimiter') || '';
        const objects = await env.OURA_BUCKET.list({ prefix, delimiter });

        return new Response(JSON.stringify({
          objects: objects.objects.map(o => ({
            key: o.key,
            size: o.size,
            uploaded: o.uploaded,
            publicUrl: `${env.R2_PUBLIC_URL}/${o.key}`
          })),
          folders: objects.delimitedPrefixes || [],
          truncated: objects.truncated,
          cursor: objects.cursor
        }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      }

      if (request.method === 'POST' && path === '/create-folder') {
        const body = await request.json().catch(() => ({}));
        const prefix = (body.prefix || body.key || '').toString();
        if (!prefix) {
          return new Response(JSON.stringify({ error: 'prefix is required' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
        }
        const normalized = prefix.endsWith('/') ? prefix : prefix + '/';
        const placeholderKey = normalized + '.keep';
        try {
          await env.OURA_BUCKET.put(placeholderKey, new Uint8Array(0), {
            httpMetadata: { contentType: 'application/x-directory' }
          });
          return new Response(JSON.stringify({ success: true, prefix: normalized, placeholder: placeholderKey }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
        } catch (e) {
          return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
        }
      }

      if (path === '/health') return new Response('ok', { headers: CORS });
      return new Response('Not Found', { status: 404, headers: CORS });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
  }
};
