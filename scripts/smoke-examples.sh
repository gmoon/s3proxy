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
LATENCY_SAMPLES=${LATENCY_SAMPLES:-10}

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

  # Latency baseline: N sequential GETs of $KEY_PATH, report mean + p95
  # so the per-example overhead (e.g. Hono's @hono/node-server double
  # conversion vs Express direct-pipe) is visible in CI output.
  # No threshold assertion — curl's -m 5 already catches catastrophic
  # hangs; the rest is data, not a gate.
  local lat=()
  for _ in $(seq 1 "$LATENCY_SAMPLES"); do
    local t0 t1 ms
    t0=$(($(date +%s%N) / 1000000))
    if ! curl -fsS -m 5 "http://localhost:$port$KEY_PATH" -o /dev/null; then
      echo "[smoke] FAIL: $example latency sample errored"
      cat "$log"
      cleanup
      return 1
    fi
    t1=$(($(date +%s%N) / 1000000))
    ms=$(( t1 - t0 ))
    lat+=("$ms")
  done
  local sum=0 max=0 sorted
  for v in "${lat[@]}"; do
    sum=$(( sum + v ))
    [ "$v" -gt "$max" ] && max=$v
  done
  local mean=$(( sum / LATENCY_SAMPLES ))
  sorted=$(printf '%s\n' "${lat[@]}" | sort -n)
  # For n<20, p95 collapses to max (no interpolation, no fractional index).
  # That's fine here — these numbers are reported, not gated.
  local p95_idx=$(( LATENCY_SAMPLES - 1 ))
  [ "$LATENCY_SAMPLES" -ge 20 ] && p95_idx=$(( LATENCY_SAMPLES * 95 / 100 ))
  local p95
  p95=$(echo "$sorted" | sed -n "$(( p95_idx + 1 ))p")

  echo "[smoke] OK: $example (health=200, $KEY_PATH=200, missing=404, n=$LATENCY_SAMPLES mean=${mean}ms max=${max}ms p95=${p95}ms)"
  cleanup
  return 0
}

failed=0
for example in examples/express-basic.ts examples/fastify-basic.ts examples/hono-basic.ts; do
  run_example "$example" || failed=1
done

if [ "$failed" -ne 0 ]; then
  echo "[smoke] FAILED"
  exit 1
fi

echo "[smoke] all examples passed"
