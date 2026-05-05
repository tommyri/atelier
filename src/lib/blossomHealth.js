const PROBE_HASH = '0'.repeat(64);
const REACHABLE_STATUSES = new Set([200, 206, 307, 308, 400, 401, 403, 404, 416, 429]);
const UNSUPPORTED_STATUSES = new Set([404, 405, 501]);

function requestHeaders(response) {
  return {
    reason: response.headers.get('x-reason') || '',
    allow: response.headers.get('allow') || response.headers.get('access-control-allow-methods') || '',
    contentLength: response.headers.get('content-length') || '',
  };
}

async function timedFetch(fetcher, url, options = {}) {
  const started = performance.now();
  const response = await fetcher(url, options);
  return { response, latency: Math.max(1, Math.round(performance.now() - started)) };
}

function endpointSupported(response) {
  return !UNSUPPORTED_STATUSES.has(response.status);
}

function statusFromProbe(retrieval, upload) {
  if (!retrieval.ok) return 'offline';
  if (retrieval.status === 503 || upload.status === 503) return 'degraded';
  return 'online';
}

export async function inspectBlossomServer(server, { fetcher = globalThis.fetch, now = new Date() } = {}) {
  if (typeof fetcher !== 'function') throw new TypeError('A fetch implementation is required.');
  const base = server.url.replace(/\/$/, '');
  const result = {
    ...server,
    status: 'offline',
    latency: 0,
    lastCheckedAt: now.toISOString(),
    lastReason: '',
    capabilities: {
      ...(server.capabilities || {}),
      retrieve: false,
      uploadPreflight: false,
      upload: false,
      mirror: false,
      media: false,
      requiresAuth: false,
    },
  };

  try {
    const retrievalProbe = await timedFetch(fetcher, `${base}/${PROBE_HASH}`, { method: 'HEAD', cache: 'no-store' });
    const retrievalHeaders = requestHeaders(retrievalProbe.response);
    const retrieval = {
      ok: REACHABLE_STATUSES.has(retrievalProbe.response.status),
      status: retrievalProbe.response.status,
      reason: retrievalHeaders.reason,
    };

    const uploadProbe = await timedFetch(fetcher, `${base}/upload`, {
      method: 'HEAD',
      cache: 'no-store',
      headers: {
        'X-SHA-256': PROBE_HASH,
        'X-Content-Length': '1',
        'X-Content-Type': 'application/octet-stream',
      },
    }).catch((error) => ({ response: null, latency: 0, error }));
    const uploadStatus = uploadProbe.response?.status || 0;
    const uploadHeaders = uploadProbe.response ? requestHeaders(uploadProbe.response) : { reason: uploadProbe.error?.message || '', allow: '', contentLength: '' };

    const mirrorProbe = await timedFetch(fetcher, `${base}/mirror`, { method: 'OPTIONS', cache: 'no-store' })
      .catch(() => ({ response: null }));
    const mirrorHeaders = mirrorProbe.response ? requestHeaders(mirrorProbe.response) : { allow: '' };

    const mediaProbe = await timedFetch(fetcher, `${base}/media`, { method: 'HEAD', cache: 'no-store' })
      .catch(() => ({ response: null }));
    const mediaStatus = mediaProbe.response?.status || 0;

    const uploadSupported = uploadProbe.response ? endpointSupported(uploadProbe.response) : false;
    const uploadRequiresAuth = [401, 403].includes(uploadStatus);
    result.status = statusFromProbe(retrieval, { status: uploadStatus });
    result.latency = retrievalProbe.latency;
    result.lastReason = retrieval.reason || uploadHeaders.reason || '';
    result.capabilities = {
      ...result.capabilities,
      retrieve: retrieval.ok,
      uploadPreflight: uploadSupported,
      upload: uploadSupported && ![400, 411, 413, 415, 503].includes(uploadStatus),
      mirror: /\bPUT\b/i.test(mirrorHeaders.allow || '') || (mirrorProbe.response ? endpointSupported(mirrorProbe.response) && mirrorProbe.response.status !== 204 : false),
      media: mediaProbe.response ? endpointSupported(mediaProbe.response) : false,
      requiresAuth: uploadRequiresAuth,
      uploadProbeStatus: uploadStatus || null,
      mediaProbeStatus: mediaStatus || null,
    };
  } catch (error) {
    result.status = 'offline';
    result.lastReason = error.message || 'Server did not respond.';
  }

  return result;
}
