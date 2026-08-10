export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    if (!response.headers.get('content-type')?.includes('text/html')) return response;

    const headers = new Headers(response.headers);
    headers.delete('content-encoding');
    headers.delete('content-length');
    const origin = new URL(request.url).origin;

    return new Response((await response.text()).replaceAll('__SITE_ORIGIN__', origin), {
      headers,
      status: response.status,
      statusText: response.statusText,
    });
  },
};
