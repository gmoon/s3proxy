import { describe, expect, it } from 'vitest';
import { S3Proxy } from '../src/index.js';
import { VERSION } from '../src/version.js';

describe('Version', () => {
  it('should export VERSION constant', () => {
    expect(VERSION).toBeDefined();
    expect(typeof VERSION).toBe('string');
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/); // Semantic version pattern
  });

  it('should match package.json version', () => {
    // Read package.json to verify version matches
    const packageJson = require('../package.json');
    expect(VERSION).toBe(packageJson.version);
  });

  it('should be accessible via S3Proxy.version() static method', () => {
    const version = S3Proxy.version();
    expect(version).toBe(VERSION);
    expect(version).toBe('3.0.0');
  });

  it('should be a valid semantic version', () => {
    // Test semantic version format (major.minor.patch)
    const semverRegex =
      /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
    expect(VERSION).toMatch(semverRegex);

    // Parse version parts
    const [, major, minor, patch] = VERSION.match(/^(\d+)\.(\d+)\.(\d+)/) || [];
    expect(Number.parseInt(major)).toBeGreaterThanOrEqual(0);
    expect(Number.parseInt(minor)).toBeGreaterThanOrEqual(0);
    expect(Number.parseInt(patch)).toBeGreaterThanOrEqual(0);
  });

  it('should be consistent across multiple calls', () => {
    const version1 = S3Proxy.version();
    const version2 = S3Proxy.version();
    expect(version1).toBe(version2);
  });
});
