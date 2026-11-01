# Changelog

All notable changes to this project are documented in this file. This project
adheres to [Semantic Versioning](https://semver.org/).

## [5.1.0](https://github.com/gmoon/s3proxy/compare/v5.0.0...v5.1.0) (2026-11-01)

### 🚀 Features

* **fetchWebKey:** add a public key-addressed Web seam,
  `fetchWebKey(key, request)`. The caller names the S3 key and the `Request`
  contributes only the method and `Range` header — the URL plays no role in key
  selection. `fetchWeb` now delegates to it. Use it when the key doesn't come
  from the URL path (a lookup, a prefix, a mount point); the key is served
  verbatim, avoiding the URL encode/decode round-trip that corrupts keys with
  `%`, `+`, spaces, or other reserved characters. Invalid keys (null byte) throw
  the typed `InvalidRequest`, consistent with the URL-addressed entry points.
  ([#203](https://github.com/gmoon/s3proxy/pull/203),
  [#162](https://github.com/gmoon/s3proxy/issues/162))
* **examples:** `examples/hono-basic.ts` gains a `/download/:id` route
  demonstrating `fetchWebKey`, covered end-to-end by the conformance gate
  ([#204](https://github.com/gmoon/s3proxy/pull/204)).

## [5.0.0](https://github.com/gmoon/s3proxy/compare/v4.2.1...v5.0.0) (2026-10-31)

### ⚠ BREAKING CHANGES

* **errors:** `fetch()`, `send()`, and `init()` now reject with a sanitized
  `S3ProxyError` (status `500`) for previously-unclassified errors instead of
  the raw `S3ServiceException`/AWS error. The original error is preserved on
  `err.cause` for server-side logging. The known mappings — `S3NotFound` (404),
  `S3Forbidden` (403), `S3InvalidRange` (416) — are unchanged. Consumers that
  branch on raw AWS error types or messages must read `err.cause` instead.
* **streaming:** a mid-stream S3 failure (after status and headers have already
  been sent) now terminates (destroys) the response rather than `end()`-ing it,
  so a truncated body surfaces as a broken connection instead of a silently
  short "successful" response. Affects `pipe()`, `middleware()`, and the
  static-site adapter.

### 🔒 Security

* sanitize unmapped S3 errors so AWS internals (bucket region/endpoint,
  request id, bucket name) can no longer leak into proxied error responses, and
  switch the core streaming path to `stream.pipeline()` so the S3 source socket
  is torn down when a client disconnects mid-transfer
  ([#124](https://github.com/gmoon/s3proxy/pull/124))
