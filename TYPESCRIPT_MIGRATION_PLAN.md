# TypeScript Migration Plan for s3proxy

## Overview

This plan outlines the complete migration of s3proxy from JavaScript to TypeScript with a modern, minimalist toolchain. The migration will improve maintainability, provide better IDE support, and enable safer refactoring.

## Current State Analysis

### Files to Migrate
- **Core files**: `index.js`, `UserException.js` (2 files)
- **Examples**: `examples/express-basic.js`, `examples/http.js` (2 files)
- **Tests**: `test/*.js` (4 files)
- **SAM app**: `examples/sam-app/s3proxy/app.js` (1 file)

### Current Dependencies Issues
- `nyc` (v15.1.0) - outdated, replaced by c8
- `mocha` + `chai` + `sinon` - can be replaced with Vitest
- `eslint` - needs TypeScript configuration
- `url` package - deprecated, use Node.js built-in

## Migration Strategy

### Phase 1: Setup TypeScript Infrastructure (Week 1)

#### 1.1 Install TypeScript Dependencies
```bash
npm install --save-dev typescript @types/node tsx
npm install --save-dev @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install --save-dev vitest @vitest/coverage-v8
npm uninstall nyc mocha chai sinon chai-http mocha-junit-reporter
```

#### 1.2 Create TypeScript Configuration
**tsconfig.json**:
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
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": false,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "coverage", "examples"]
}
```

**tsconfig.examples.json**:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "./examples",
    "outDir": "./dist/examples"
  },
  "include": ["examples/**/*"]
}
```

**tsconfig.test.json**:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "./test",
    "outDir": "./dist/test",
    "types": ["vitest/globals", "node"]
  },
  "include": ["test/**/*", "src/**/*"]
}
```

#### 1.3 Update ESLint Configuration
**.eslintrc.json**:
```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "@typescript-eslint/recommended",
    "@typescript-eslint/recommended-requiring-type-checking"
  ],
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module",
    "project": ["./tsconfig.json", "./tsconfig.examples.json", "./tsconfig.test.json"]
  },
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/prefer-nullish-coalescing": "error",
    "@typescript-eslint/prefer-optional-chain": "error"
  },
  "ignorePatterns": ["dist/", "node_modules/", "coverage/"]
}
```

#### 1.4 Setup Vitest Configuration
**vitest.config.ts**:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['dist/', 'examples/', 'test/', 'coverage/']
    },
    testTimeout: 30000
  }
});
```

### Phase 2: Core Library Migration (Week 2)

#### 2.1 Create Type Definitions
**src/types.ts**:
```typescript
import { S3ClientConfig } from '@aws-sdk/client-s3';
import { IncomingMessage, ServerResponse } from 'http';

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
}

export interface ExpressResponse extends ServerResponse {
  writeHead(statusCode: number, headers?: Record<string, string>): void;
}
```

#### 2.2 Migrate UserException
**src/UserException.ts**:
```typescript
export class UserException extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'UserException';
    this.code = code;
    
    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UserException);
    }
  }
}
```

#### 2.3 Migrate Main S3Proxy Class
**src/index.ts**:
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
import { parse as parseUrl } from 'url';
import { UserException } from './UserException.js';
import type {
  S3ProxyConfig,
  ParsedRequest,
  S3ProxyResponse,
  ExpressRequest,
  ExpressResponse
} from './types.js';

const packageJson = await import('../package.json', { assert: { type: 'json' } });

export class S3Proxy extends EventEmitter {
  private readonly bucket: string;
  private readonly options: Omit<S3ProxyConfig, 'bucket'>;
  private s3?: S3Client;

  constructor(config: S3ProxyConfig) {
    super();
    
    if (!config?.bucket) {
      throw new UserException('InvalidParameterList', 'bucket parameter is required');
    }

    this.bucket = config.bucket;
    this.options = Object.fromEntries(
      Object.entries(config).filter(([key]) => key !== 'bucket')
    );
  }

  public static version(): string {
    return packageJson.default.version;
  }

  // ... rest of the class implementation
}

export { UserException };
export default S3Proxy;
```

### Phase 3: Test Migration (Week 3)

#### 3.1 Migrate to Vitest
**test/s3proxy.test.ts**:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S3Proxy, UserException } from '../src/index.js';

describe('S3Proxy', () => {
  describe('constructor', () => {
    it('should create an instance with valid config', () => {
      const proxy = new S3Proxy({ bucket: 's3proxy-public' });
      expect(proxy).toBeInstanceOf(S3Proxy);
    });

    it('should throw UserException without bucket', () => {
      expect(() => new S3Proxy({} as any)).toThrow(UserException);
    });
  });

  describe('initialization', () => {
    let proxy: S3Proxy;

    beforeEach(() => {
      proxy = new S3Proxy({ bucket: 's3proxy-public' });
    });

    it('should throw exception if not initialized', () => {
      expect(() => proxy.isInitialized()).toThrow('S3Proxy is uninitialized');
    });

    it('should emit init event', async () => {
      const initPromise = new Promise<void>((resolve) => {
        proxy.on('init', resolve);
      });

      await proxy.init();
      await initPromise;
    });
  });
});
```

#### 3.2 Create Test Utilities
**test/utils.ts**:
```typescript
import type { ExpressRequest, ExpressResponse } from '../src/types.js';

export function createMockRequest(path: string, headers: Record<string, string> = {}): ExpressRequest {
  return {
    path,
    headers,
    url: path,
    method: 'GET'
  } as ExpressRequest;
}

export function createMockResponse(): ExpressResponse {
  const response = {
    writeHead: vi.fn(),
    end: vi.fn(),
    pipe: vi.fn()
  } as unknown as ExpressResponse;
  
  return response;
}
```

### Phase 4: Examples Migration (Week 4)

#### 4.1 Migrate Express Example
**examples/express-basic.ts**:
```typescript
import express from 'express';
import { createDebugger } from 'debug';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import addRequestId from 'express-request-id';
import { S3Proxy } from '../src/index.js';

const debug = createDebugger('s3proxy');
const port = Number(process.env.PORT) || 3000;
const app = express();

// ... rest of implementation with proper typing
```

### Phase 5: Build System & Scripts (Week 5)

#### 5.1 Update package.json Scripts
```json
{
  "scripts": {
    "build": "tsc && tsc -p tsconfig.examples.json",
    "build:watch": "tsc --watch",
    "dev": "tsx examples/express-basic.ts",
    "start": "node dist/examples/express-basic.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src examples test --ext .ts",
    "lint:fix": "eslint src examples test --ext .ts --fix",
    "type-check": "tsc --noEmit",
    "clean": "rm -rf dist coverage",
    "prepublishOnly": "npm run clean && npm run build && npm run test"
  },
  "main": "dist/src/index.js",
  "types": "dist/src/index.d.ts",
  "files": [
    "dist/src/**/*",
    "README.md",
    "LICENSE"
  ]
}
```

#### 5.2 Update Dependencies
**New package.json dependencies**:
```json
{
  "dependencies": {
    "@aws-sdk/client-s3": "^3.731.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.11.0",
    "@typescript-eslint/eslint-plugin": "^6.19.0",
    "@typescript-eslint/parser": "^6.19.0",
    "@vitest/coverage-v8": "^1.2.0",
    "artillery": "^2.0.21",
    "eslint": "^8.57.1",
    "express": "^4.21.2",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3",
    "vitest": "^1.2.0"
  }
}
```

## Migration Benefits

### Immediate Benefits
- **Type Safety**: Catch errors at compile time
- **Better IDE Support**: IntelliSense, refactoring, navigation
- **Modern Tooling**: Faster builds with `tsx`, better testing with Vitest
- **Dependency Updates**: Remove outdated packages

### Long-term Benefits
- **Maintainability**: Easier to refactor and extend
- **Documentation**: Types serve as living documentation
- **Contributor Experience**: Easier for new contributors
- **Performance**: Better tree-shaking and optimization

## Risk Mitigation

### Backwards Compatibility
- Maintain same public API
- Keep JavaScript examples for users not using TypeScript
- Publish both TypeScript declarations and compiled JavaScript

### Testing Strategy
- Migrate tests incrementally
- Maintain 100% test coverage
- Add type-specific tests
- Keep integration tests unchanged

### Rollback Plan
- Keep current JavaScript version in `legacy` branch
- Gradual rollout with beta versions
- Monitor npm download metrics and issue reports

## Timeline

| Week | Phase | Deliverables |
|------|-------|-------------|
| 1 | Infrastructure | TypeScript config, build system, Vitest setup |
| 2 | Core Migration | Main library converted to TypeScript |
| 3 | Test Migration | All tests converted to Vitest + TypeScript |
| 4 | Examples | Examples converted with proper typing |
| 5 | Polish | Documentation, CI/CD updates, beta release |

## Success Criteria

- [ ] All code compiles without TypeScript errors
- [ ] 100% test coverage maintained
- [ ] All existing functionality preserved
- [ ] Performance benchmarks unchanged
- [ ] Documentation updated
- [ ] CI/CD pipeline working
- [ ] Beta version published successfully

## Post-Migration Tasks

1. **Update Documentation**: README, API docs, examples
2. **CI/CD Updates**: GitHub Actions for TypeScript
3. **Performance Testing**: Ensure no regressions
4. **Community Communication**: Announce migration, provide migration guide
5. **Monitoring**: Track adoption and issues

This migration will modernize s3proxy while maintaining its reliability and performance characteristics.
