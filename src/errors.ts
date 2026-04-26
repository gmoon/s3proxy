/**
 * Typed errors thrown by S3Proxy. Replace v3.x's silent empty-stream
 * substitution: callers must now decide how to render each error.
 *
 * Discriminate by `instanceof` (preferred) or by `err.name` — the
 * subclass name doubles as the error code, e.g. 'S3NotFound'.
 */
export class S3ProxyError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'S3ProxyError';
    this.statusCode = statusCode;
  }
}

export class S3NotFound extends S3ProxyError {
  constructor(target: string, options?: { cause?: unknown }) {
    super(`S3 resource not found: ${target}`, 404, options);
    this.name = 'S3NotFound';
  }
}

export class S3Forbidden extends S3ProxyError {
  constructor(target: string, options?: { cause?: unknown }) {
    super(`Access denied: ${target}`, 403, options);
    this.name = 'S3Forbidden';
  }
}

export class S3InvalidRange extends S3ProxyError {
  constructor(target: string, options?: { cause?: unknown }) {
    super(`Range not satisfiable: ${target}`, 416, options);
    this.name = 'S3InvalidRange';
  }
}

export class InvalidRequest extends S3ProxyError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, 400, options);
    this.name = 'InvalidRequest';
  }
}
