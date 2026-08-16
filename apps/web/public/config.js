// Rewritten by docker-entrypoint.sh on container start. The values here are the
// local-development defaults; nothing in the bundle depends on them, so a build
// never has to be repeated just because a URL changed.
window.__MESSENGER_CONFIG__ = {
  apiUrl: 'http://localhost:4000',
  wsUrl: 'http://localhost:4000',
  livekitUrl: 'ws://localhost:7880',
};
