#!/usr/bin/env bash
#
# Boot a tsx example server on a port, wait for it, run a command against it,
# and always kill the server on exit. tsx runs the TypeScript in src/ directly,
# so the command exercises your local s3proxy changes with no build and no
# Docker image.
#
# Usage: with-local-server.sh <example.ts> <port> <command...>
#   BUCKET defaults to s3proxy-public; override via the environment.
set -u

EXAMPLE="$1"
PORT="$2"
shift 2

PORT="$PORT" BUCKET="${BUCKET:-s3proxy-public}" npx tsx "$EXAMPLE" &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

if ! npx wait-on -t 30000 "http://localhost:${PORT}/index.html"; then
  echo "server ($EXAMPLE) failed to start on port ${PORT}" >&2
  exit 1
fi

"$@"
