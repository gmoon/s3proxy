/**
 * Typed errors thrown by S3Proxy. Replace v3.x's silent empty-stream
 * substitution: callers must now decide how to render each error.
 */
export class S3ProxyError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'S3ProxyError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class S3NotFound extends S3ProxyError {
  constructor(target: string, options?: { cause?: unknown }) {
    super('S3NotFound', `S3 resource not found: ${target}`, 404, options);
    this.name = 'S3NotFound';
  }
}

export class S3Forbidden extends S3ProxyError {
  constructor(target: string, options?: { cause?: unknown }) {
    super('S3Forbidden', `Access denied: ${target}`, 403, options);
    this.name = 'S3Forbidden';
  }
}

export class S3InvalidRange extends S3ProxyError {
  constructor(target: string, options?: { cause?: unknown }) {
    super('S3InvalidRange', `Range not satisfiable: ${target}`, 416, options);
    this.name = 'S3InvalidRange';
  }
}

export class InvalidRequest extends S3ProxyError {
  constructor(message: string, options?: { cause?: unknown }) {
    super('InvalidRequest', message, 400, options);
    this.name = 'InvalidRequest';
  }
}
