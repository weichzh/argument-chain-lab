import {
  CANDIDATE_RECORD_SCHEMA,
  MAX_CONTRIBUTION_BYTES,
  findSensitiveContent,
  hashContributionPackage,
  normalizeContributionPackage,
} from '../../shared/contribution-contract.js';

const JSON_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

function allowedOrigins(env) {
  return new Set(String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean));
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin || !allowedOrigins(env).has(origin)) return {};
  return {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function jsonResponse(request, env, status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...corsHeaders(request, env),
      ...headers,
    },
  });
}

function errorResponse(request, env, status, code, issues, headers) {
  const error = { code };
  if (issues?.length) error.issues = issues.map(({ path, code: issueCode }) => ({ path, code: issueCode }));
  return jsonResponse(request, env, status, { error }, headers);
}

async function readBodyWithLimit(request) {
  const declaredLength = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_CONTRIBUTION_BYTES) {
    return { ok: false, code: 'payload_too_large' };
  }

  if (!request.body) return { ok: false, code: 'invalid_json' };
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_CONTRIBUTION_BYTES) {
      await reader.cancel();
      return { ok: false, code: 'payload_too_large' };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, code: 'invalid_json' };
  }
}

async function acceptContribution(request, env) {
  if (!env.CANDIDATES || typeof env.CANDIDATES.put !== 'function') {
    return errorResponse(request, env, 503, 'storage_unavailable');
  }
  const contentType = request.headers.get('Content-Type') || '';
  if (!/^application\/json(?:\s*;|$)/iu.test(contentType)) {
    return errorResponse(request, env, 415, 'unsupported_media_type');
  }
  const contentEncoding = (request.headers.get('Content-Encoding') || 'identity').toLowerCase();
  if (contentEncoding !== 'identity') {
    return errorResponse(request, env, 415, 'unsupported_content_encoding');
  }

  const body = await readBodyWithLimit(request);
  if (!body.ok) {
    return errorResponse(request, env, body.code === 'payload_too_large' ? 413 : 400, body.code);
  }

  const normalized = normalizeContributionPackage(body.value);
  if (!normalized.ok) {
    return errorResponse(request, env, 422, 'invalid_contribution', normalized.issues);
  }
  const sensitive = findSensitiveContent(normalized.value);
  if (sensitive.length) {
    return errorResponse(request, env, 422, 'sensitive_content_detected', sensitive);
  }

  const hashResult = await hashContributionPackage(normalized.value);
  if (!hashResult.ok) return errorResponse(request, env, 422, 'invalid_contribution', hashResult.issues);
  const contentHash = hashResult.value;
  const key = `candidates/v1/${contentHash.slice(7, 9)}/${contentHash.slice(7)}.json`;

  try {
    if (typeof env.CANDIDATES.head === 'function' && await env.CANDIDATES.head(key)) {
      return jsonResponse(request, env, 200, { accepted: true, duplicate: true, contentHash });
    }

    const record = {
      schema: CANDIDATE_RECORD_SCHEMA,
      version: 1,
      contentHash,
      contribution: normalized.value,
    };
    await env.CANDIDATES.put(key, JSON.stringify(record), {
      httpMetadata: { contentType: 'application/json; charset=utf-8' },
      customMetadata: { schemaVersion: '1' },
    });
  } catch {
    return errorResponse(request, env, 503, 'storage_unavailable');
  }
  return jsonResponse(request, env, 202, { accepted: true, duplicate: false, contentHash });
}

export async function handleRequest(request, env) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  if (origin && !allowedOrigins(env).has(origin)) {
    return errorResponse(request, env, 403, 'origin_not_allowed');
  }

  if (request.method === 'OPTIONS') {
    if (url.pathname !== '/v1/contributions') return errorResponse(request, env, 404, 'not_found');
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }
  if (request.method === 'GET' && url.pathname === '/health') {
    return jsonResponse(request, env, 200, { ok: true });
  }
  if (url.pathname !== '/v1/contributions') return errorResponse(request, env, 404, 'not_found');
  if (request.method !== 'POST') {
    return errorResponse(request, env, 405, 'method_not_allowed', undefined, { Allow: 'POST, OPTIONS' });
  }
  return acceptContribution(request, env);
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  },
};
