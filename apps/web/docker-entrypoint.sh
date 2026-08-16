#!/bin/sh
# Writes the runtime configuration the bundle reads on boot. nginx runs every
# script in /docker-entrypoint.d before starting, so this lands before the first
# request — and rebuilding the image for a new URL is never necessary.
set -eu

# Prefixed because the compose file shares one .env with api-core, whose own
# LIVEKIT_URL points inside the Docker network — the browser needs the public one.
cat > /usr/share/nginx/html/config.js <<EOF
window.__MESSENGER_CONFIG__ = {
  apiUrl: '${WEB_API_URL:-}',
  wsUrl: '${WEB_WS_URL:-}',
  livekitUrl: '${WEB_LIVEKIT_URL:-}',
};
EOF

echo "messenger: config.js written (api=${WEB_API_URL:-unset}, livekit=${WEB_LIVEKIT_URL:-unset})"
