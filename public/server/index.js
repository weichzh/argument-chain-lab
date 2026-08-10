export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === '/runtime-config.js') {
      return new Response("window.__ARGUMENT_CHAIN_BANK_ENDPOINT__ = '';\n", {
        headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
      });
    }
    return env.ASSETS.fetch(request);
  },
};
