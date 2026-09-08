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

# The Content-Security-Policy has to name the backends by origin, and those are
# only known here — same reason config.js is written at start rather than built
# in. In the single-domain deployment they all collapse into 'self'; in a split
# one (or in local dev) they are separate origins and must be listed.
#
# The websocket origins are added in both schemes: the browser matches the URL
# it dials, and that is ws:// or wss:// even when the page is https.
origins="'self' ${WEB_API_URL:-} ${WEB_WS_URL:-} ${WEB_LIVEKIT_URL:-}"
for url in "${WEB_API_URL:-}" "${WEB_WS_URL:-}"; do
  case "$url" in
    https://*) origins="$origins wss://${url#https://}" ;;
    http://*) origins="$origins ws://${url#http://}" ;;
  esac
done

# The same origin usually arrives two or three times over — API, socket and SFU
# are one host in the single-domain deployment — and a policy that repeats
# itself is one nobody can read.
connect_src=$(printf '%s\n' $origins | awk 'NF && !seen[$0]++' | tr '\n' ' ')

cat > /etc/nginx/messenger-headers.conf <<EOF
# 'unsafe-inline' for styles only: React writes element style attributes, and
# the skins are built on them. Scripts get no such exemption — that is the half
# of the policy that stops an injected string from becoming code.
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; media-src 'self' blob:; connect-src ${connect_src}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" always;
# Clickjacking: the app has a microphone and a camera behind its buttons, so
# being framed by another page is never something it wants. frame-ancestors
# above says the same to browsers that read CSP; this covers the rest.
add_header X-Frame-Options "DENY" always;
# A response the browser sniffs into another type is a response it may execute.
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
# Nobody in a frame gets the camera, and this page only takes one when a call
# asks for it. TLS terminates upstream, so HSTS is Traefik's to send.
add_header Permissions-Policy "camera=(self), microphone=(self), geolocation=(), payment=()" always;
EOF

echo "messenger: security headers written (connect-src: ${connect_src})"

# /embed/:token (EmbedCallScreen) is the one screen meant to be framed — by a
# single, explicitly configured embedder, never by anyone else. Everything
# else in the app keeps frame-ancestors 'none' above; this is a second,
# separate header file included only from the /embed/ location in nginx.conf.
#
# X-Frame-Options has no per-origin allowlist (only DENY/SAMEORIGIN), so an
# allowed embedder means omitting it entirely and relying on CSP
# frame-ancestors, which every current browser enforces on its own.
if [ -n "${EMBED_ALLOWED_ORIGIN:-}" ]; then
  cat > /etc/nginx/messenger-embed-headers.conf <<EOF
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; media-src 'self' blob:; connect-src ${connect_src}; frame-ancestors 'self' ${EMBED_ALLOWED_ORIGIN}; base-uri 'self'; form-action 'self'; object-src 'none'" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(self \"${EMBED_ALLOWED_ORIGIN}\"), microphone=(self \"${EMBED_ALLOWED_ORIGIN}\"), geolocation=(), payment=()" always;
EOF
  echo "messenger: embed headers written (frame-ancestors: 'self' ${EMBED_ALLOWED_ORIGIN})"
else
  # No embedder configured: /embed/ stays exactly as unframable as the rest of
  # the app rather than silently defaulting to open.
  cp /etc/nginx/messenger-headers.conf /etc/nginx/messenger-embed-headers.conf
  echo "messenger: EMBED_ALLOWED_ORIGIN not set, /embed/ stays unframable"
fi
