import { createRequire } from 'node:module';

const pkg = createRequire(import.meta.url)('s3proxy/package.json') as { version: string };

export const VERSION: string = pkg.version;
