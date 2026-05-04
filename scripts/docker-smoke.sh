#!/usr/bin/env sh
set -eu

docker compose up -d --build
cleanup() {
  docker compose down
}
trap cleanup EXIT INT TERM

i=0
until curl -fsS http://127.0.0.1:26453/healthz >/dev/null; do
  i=$((i + 1))
  if [ "$i" -ge 40 ]; then
    docker compose logs
    echo "server did not become healthy" >&2
    exit 1
  fi
  sleep 2
done

curl -fsS http://127.0.0.1:26453/ >/dev/null
curl -fsS http://127.0.0.1:26453/api/version | grep '"version":"0.1.0"' >/dev/null
curl -fsS http://127.0.0.1:26453/api/catalog | grep '"circles"' >/dev/null
curl -fsS http://127.0.0.1:26453/metrics | grep 'pcarad_http_requests_total' >/dev/null

echo "Docker smoke OK on http://127.0.0.1:26453"
