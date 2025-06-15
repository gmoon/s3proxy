# TypeScript Migration Examples

This document shows concrete examples of how the current JavaScript code will be converted to TypeScript.

## Core Library Migration

### Before: index.js (JavaScript)
```javascript
const EventEmitter = require('events');
const { Readable } = require('stream');
const {
  S3Client, GetObjectCommand, HeadBucketCommand, HeadObjectCommand,
  NoSuchKey, NoSuchBucket, S3ServiceException,
} = require('@aws-sdk/client-s3');

module.exports = class s3proxy extends EventEmitter {
  constructor(p) {
    super();
    if (!p) {
      throw new UserException('InvalidParameterList', 'constructor parameters are required');
    }
    if (!p.bucket) {
      throw new UserException('InvalidParameterList', 'bucket parameter is required');
    }
    this.bucket = p.bucket;
    this.options = Object.getOwnPropertyNames(p)
      .filter((name) => name !== 'bucket')
      .reduce((obj, name) => {
        const withName = {};
        withName[name] = p[name];
        return { ...obj, ...withName };
      }, {});
  }

  static mapHeaderToParam(req, headerKey, paramKey) {
    let retval = {};
    if (typeof req.headers !== 'undefined') {
      if (typeof req.headers[headerKey] !== 'undefined') {
        retval = { [paramKey]: req.headers[headerKey] };
      }
    }
    return retval;
  }
}
```

### After: src/index.ts (TypeScript)
```typescript
import { EventEmitter } from 'events';
import { Readable } from 'stream';
import {
  S3Client,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  NoSuchKey,
  NoSuchBucket,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { UserException } from './UserException.js';
import type {
  S3ProxyConfig,
  ParsedRequest,
  S3ProxyResponse,
  ExpressRequest,
  ExpressResponse
} from './types.js';

export class S3Proxy extends EventEmitter {
  private readonly bucket: string;
  private readonly options: Omit<S3ProxyConfig, 'bucket'>;
  private s3?: S3Client;

  constructor(config: S3ProxyConfig) {
    super();
    
    if (!config) {
      throw new UserException('InvalidParameterList', 'constructor parameters are required');
    }
    if (!config.bucket) {
      throw new UserException('InvalidParameterList', 'bucket parameter is required');
    }

    this.bucket = config.bucket;
    this.options = Object.fromEntries(
      Object.entries(config).filter(([key]) => key !== 'bucket')
    ) as Omit<S3ProxyConfig, 'bucket'>;
  }

  public static mapHeaderToParam(
    req: ExpressRequest,
    headerKey: string,
    paramKey: string
  ): Record<string, string> | Record<string, never> {
    if (req.headers?.[headerKey]) {
      const headerValue = req.headers[headerKey];
      const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
      return { [paramKey]: value };
    }
    return {};
  }

  public async init(): Promise<void> {
    try {
      this.s3 = new S3Client(this.options);
      await this.healthCheck();
      this.emit('init');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  public async get(req: ExpressRequest, res: ExpressResponse): Promise<Readable> {
    const { s3stream, statusCode, headers } = await this.getObject(req);
    res.writeHead(statusCode, headers);
    return s3stream;
  }
}
```

## Type Definitions

### src/types.ts
```typescript
import type { S3ClientConfig } from '@aws-sdk/client-s3';
import type { IncomingMessage, ServerResponse } from 'http';

export interface S3ProxyConfig extends S3ClientConfig {
  bucket: string;
}

export interface ParsedRequest {
  key: string;
  query: Record<string, string | string[]>;
}

export interface S3ProxyResponse {
  s3stream: NodeJS.ReadableStream;
  statusCode: number;
  headers: Record<string, string>;
}

export interface ExpressRequest extends IncomingMessage {
  path?: string;
  query?: Record<string, string | string[]>;
  headers: Record<string, string | string[]>;
  url: string;
  method?: string;
}

export interface ExpressResponse extends ServerResponse {
  writeHead(statusCode: number, headers?: Record<string, string>): this;
}

export interface S3ProxyEvents {
  init: () => void;
  error: (error: Error) => void;
}

// Utility types for better type safety
export type S3ProxyOptions = Omit<S3ProxyConfig, 'bucket'>;
export type HeaderMap = Record<string, string | string[]>;
export type S3Params = {
  Bucket: string;
  Key: string;
  Range?: string;
};
```

## Test Migration

### Before: test/s3proxy.js (Mocha + Chai)
```javascript
const chai = require('chai');
const S3Proxy = require('..');

const { expect } = chai;

describe('s3proxy', () => {
  describe('constructor', () => {
    it('should return an object', () => {
      const proxy = new S3Proxy({ bucket: 's3proxy-public' });
      expect(proxy).to.be.an('object');
    });
  });

  describe('initialization', () => {
    const proxy = new S3Proxy({ bucket: 's3proxy-public' });
    it('should throw an exception if it is not initialized', () => {
      expect(() => { proxy.isInitialized() }).to.throw('S3Proxy is uninitialized');
    });
  });
});
```

### After: test/s3proxy.test.ts (Vitest)
```typescript
import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { S3Proxy, UserException } from '../src/index.js';
import type { S3ProxyConfig } from '../src/types.js';

describe('S3Proxy', () => {
  describe('constructor', () => {
    it('should create an instance with valid config', () => {
      const config: S3ProxyConfig = { bucket: 's3proxy-public' };
      const proxy = new S3Proxy(config);
      expect(proxy).toBeInstanceOf(S3Proxy);
    });

    it('should throw UserException without bucket', () => {
      expect(() => new S3Proxy({} as S3ProxyConfig)).toThrow(UserException);
      expect(() => new S3Proxy({} as S3ProxyConfig)).toThrow('bucket parameter is required');
    });

    it('should throw UserException with null config', () => {
      expect(() => new S3Proxy(null as unknown as S3ProxyConfig)).toThrow(UserException);
    });
  });

  describe('initialization', () => {
    let proxy: S3Proxy;
    const config: S3ProxyConfig = { bucket: 's3proxy-public' };

    beforeEach(() => {
      proxy = new S3Proxy(config);
    });

    it('should throw exception if not initialized', () => {
      expect(() => proxy.isInitialized()).toThrow('S3Proxy is uninitialized');
    });

    it('should emit init event on successful initialization', async () => {
      const initSpy = vi.fn();
      proxy.on('init', initSpy);

      await proxy.init();
      
      expect(initSpy).toHaveBeenCalledOnce();
    });

    it('should emit error event on initialization failure', async () => {
      const errorSpy = vi.fn();
      const invalidProxy = new S3Proxy({ 
        bucket: 'invalid-bucket-name-that-does-not-exist',
        region: 'invalid-region'
      });
      
      invalidProxy.on('error', errorSpy);

      await expect(invalidProxy.init()).rejects.toThrow();
      expect(errorSpy).toHaveBeenCalledOnce();
    });
  });

  describe('static methods', () => {
    it('should return version string', () => {
      const version = S3Proxy.version();
      expect(version).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('should map headers correctly', () => {
      const req = {
        headers: { 'range': 'bytes=0-99' }
      } as any;

      const result = S3Proxy.mapHeaderToParam(req, 'range', 'Range');
      expect(result).toEqual({ Range: 'bytes=0-99' });
    });

    it('should return empty object for missing headers', () => {
      const req = { headers: {} } as any;
      const result = S3Proxy.mapHeaderToParam(req, 'range', 'Range');
      expect(result).toEqual({});
    });
  });
});
```

## Example Migration

### Before: examples/express-basic.js
```javascript
const express = require('express');
const S3Proxy = require('..');

const port = process.env.PORT;
const app = express();

const bucketName = 's3proxy-public';
const proxy = new S3Proxy({ bucket: bucketName });
proxy.init();

app.route('/*')
  .get(async (req, res) => {
    (await proxy.get(req, res)).on('error', (err) => {
      handleError(req, res, err);
    }).pipe(res);
  });
```

### After: examples/express-basic.ts
```typescript
import express, { type Request, type Response } from 'express';
import { S3Proxy } from '../src/index.js';
import type { ExpressRequest, ExpressResponse } from '../src/types.js';

const port = Number(process.env.PORT) || 3000;
const app = express();

const bucketName = process.env.BUCKET || 's3proxy-public';
const proxy = new S3Proxy({ bucket: bucketName });

// Initialize proxy with proper error handling
try {
  await proxy.init();
  console.log(`S3Proxy initialized for bucket: ${bucketName}`);
} catch (error) {
  console.error('Failed to initialize S3Proxy:', error);
  process.exit(1);
}

function handleError(req: Request, res: Response, err: Error & { statusCode?: number; code?: string }): void {
  const statusCode = err.statusCode || 500;
  const errorResponse = `<?xml version="1.0"?>
<error time="${new Date().toISOString()}" code="${err.code || 'InternalError'}" statusCode="${statusCode}" url="${req.url}" method="${req.method}">${err.message}</error>`;
  
  res.status(statusCode).type('application/xml').send(errorResponse);
}

app.route('/*')
  .get(async (req: Request, res: Response) => {
    try {
      const stream = await proxy.get(req as ExpressRequest, res as ExpressResponse);
      stream.on('error', (err: Error) => {
        handleError(req, res, err);
      }).pipe(res);
    } catch (error) {
      handleError(req, res, error as Error);
    }
  });

if (port > 0) {
  app.listen(port, () => {
    console.log(`s3proxy listening on port ${port}`);
  });
}

export default app;
```

## Build Configuration

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": false,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitAny": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "coverage", "examples", "test"]
}
```

### vitest.config.ts
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json'],
      exclude: [
        'dist/',
        'examples/',
        'test/',
        'coverage/',
        '**/*.d.ts',
        '**/*.config.*'
      ],
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        }
      }
    },
    testTimeout: 30000,
    hookTimeout: 30000
  },
  esbuild: {
    target: 'node18'
  }
});
```

## Key Improvements

1. **Type Safety**: All parameters, return types, and interfaces are properly typed
2. **Modern Syntax**: Uses ES modules, async/await, and modern JavaScript features
3. **Better Error Handling**: Typed error objects with proper error propagation
4. **Improved Testing**: Vitest provides better performance and modern testing features
5. **Developer Experience**: Better IDE support, autocomplete, and refactoring capabilities
6. **Maintainability**: Self-documenting code through types, easier to understand and modify

This migration maintains 100% API compatibility while providing significant improvements in developer experience and code quality.
