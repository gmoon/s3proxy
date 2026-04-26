#!/usr/bin/env bash
# Smoke test for examples/*.ts.
# Boots each example on a free port, checks /health and a known S3 key, kills it.
# Exits 0 on success, 1 on any assertion failure.
#
# Required: AWS credentials with read access to the s3proxy-public bucket
# (the same bucket integration tests use).

set -euo pipefail

BUCKET=${BUCKET:-s3proxy-public}
KEY_PATH=${KEY_PATH:-/index.html}
START_TIMEOUT_MS=${START_TIMEOUT_MS:-15000}

find_free_port() {
  python3 -c 'import socket; s=socket.socket(); s.bind(("",0)); print(s.getsockname()[1]); s.close()'
}

run_example() {
  local example=$1
  local port
  port=$(find_free_port)
  local log
  log=$(mktemp -t s3proxy-smoke.XXXXXX)

  echo "[smoke] $example: starting on port $port (bucket=$BUCKET)"

  PORT=$port BUCKET=$BUCKET npx tsx "$example" >"$log" 2>&1 &
  local pid=$!

  cleanup() {
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
    rm -f "$log"
  }

  local deadline=$(( $(date +%s%N) / 1000000 + START_TIMEOUT_MS ))
  while true; do
    if curl -fsS -m 1 "http://localhost:$port/health" -o /dev/null 2>/dev/null; then
      break
    fi
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "[smoke] FAIL: $example process exited before becoming ready"
      cat "$log"
      cleanup
      return 1
    fi
    if [ "$(date +%s%N | cut -c1-13)" -gt "$deadline" ]; then
      echo "[smoke] FAIL: $example did not become ready within ${START_TIMEOUT_MS}ms"
      cat "$log"
      cleanup
      return 1
    fi
    sleep 0.2
  done

  local health
  health=$(curl -o /dev/null -s -w "%{http_code}" "http://localhost:$port/health")
  if [ "$health" != "200" ]; then
    echo "[smoke] FAIL: $example /health returned $health (expected 200)"
    cat "$log"
    cleanup
    return 1
  fi

  local key
  key=$(curl -o /dev/null -s -w "%{http_code}" "http://localhost:$port$KEY_PATH")
  if [ "$key" != "200" ]; then
    echo "[smoke] FAIL: $example $KEY_PATH returned $key (expected 200)"
    cat "$log"
    cleanup
    return 1
  fi

  # Verify a missing key returns 404 (not 200, not 500). v4 turns the
  # underlying S3NotFound throw into a 4xx via the example's error
  # handler — a regression here would silently swallow the throw.
  local missing
  missing=$(curl -o /dev/null -s -w "%{http_code}" "http://localhost:$port/__smoke-missing-$$.bin")
  if [ "$missing" != "404" ]; then
    echo "[smoke] FAIL: $example missing-key returned $missing (expected 404)"
    cat "$log"
    cleanup
    return 1
  fi

  echo "[smoke] OK: $example (health=200, $KEY_PATH=200, missing=404)"
  cleanup
  return 0
}

failed=0
for example in examples/express-basic.ts examples/fastify-basic.ts; do
  run_example "$example" || failed=1
done

if [ "$failed" -ne 0 ]; then
  echo "[smoke] FAILED"
  exit 1
fi

echo "[smoke] all examples passed"
