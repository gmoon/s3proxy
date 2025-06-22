import crypto from 'node:crypto';
import { beforeAll, describe, expect, test } from 'vitest';

// Configuration
const BASE_URL = process.env.S3PROXY_URL || 'http://localhost:8080';
const TIMEOUT = 30000; // 30 seconds for large file tests

// Test data expectations (these should match your S3 bucket contents)
const EXPECTED_FILES = {
  '/index.html': {
    contentType: 'text/html',
    contentLength: 338,
    statusCode: 200,
  },
  '/large.bin': {
    contentType: 'application/octet-stream',
    contentLength: 10485760, // 10MB
    statusCode: 200,
    // Expected MD5 hash of the large.bin file in S3
    // You'll need to update this with the actual MD5 of your file
    expectedMd5: null, // Set this after first run or calculate from S3
  },
  '/test1m.tmp': {
    contentType: 'binary/octet-stream',
    contentLength: 1048576, // 1MB
    statusCode: 200,
  },
  '/zerobytefile': {
    contentType: 'binary/octet-stream',
    contentLength: 0,
    statusCode: 200,
  },
};

// Utility functions
async function fetchWithTimeout(url, options = {}, timeout = TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

function calculateMd5(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

function calculateSha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

describe('S3Proxy Validation Tests', () => {
  beforeAll(() => {
    console.log(`Running validation tests against: ${BASE_URL}`);
  });

  describe('Basic File Serving', () => {
    test('should serve HTML file with correct headers', async () => {
      const response = await fetchWithTimeout(`${BASE_URL}/index.html`);

      expect(response.status).toBe(EXPECTED_FILES['/index.html'].statusCode);
      expect(response.headers.get('content-type')).toBe(EXPECTED_FILES['/index.html'].contentType);
      expect(Number.parseInt(response.headers.get('content-length'))).toBe(
        EXPECTED_FILES['/index.html'].contentLength
      );

      const content = await response.text();
      expect(content).toContain('<html lang="en">'); // Basic HTML validation
      expect(content.length).toBe(EXPECTED_FILES['/index.html'].contentLength);
    });

    test('should serve zero-byte file correctly', async () => {
      const response = await fetchWithTimeout(`${BASE_URL}/zerobytefile`);

      expect(response.status).toBe(EXPECTED_FILES['/zerobytefile'].statusCode);
      expect(response.headers.get('content-type')).toBe(
        EXPECTED_FILES['/zerobytefile'].contentType
      );
      expect(Number.parseInt(response.headers.get('content-length'))).toBe(
        EXPECTED_FILES['/zerobytefile'].contentLength
      );

      const content = await response.arrayBuffer();
      expect(content.byteLength).toBe(0);
    });

    test('should return 404 for non-existent files', async () => {
      const response = await fetchWithTimeout(`${BASE_URL}/nonexistent-file.txt`);
      expect(response.status).toBe(404);
    });
  });

  describe('Binary File Integrity', () => {
    test(
      'should serve large binary file without corruption',
      async () => {
        const response = await fetchWithTimeout(`${BASE_URL}/large.bin`);

        expect(response.status).toBe(EXPECTED_FILES['/large.bin'].statusCode);
        expect(response.headers.get('content-type')).toBe(EXPECTED_FILES['/large.bin'].contentType);
        expect(Number.parseInt(response.headers.get('content-length'))).toBe(
          EXPECTED_FILES['/large.bin'].contentLength
        );

        const buffer = await response.arrayBuffer();
        expect(buffer.byteLength).toBe(EXPECTED_FILES['/large.bin'].contentLength);

        // Calculate and log MD5 for future reference
        const uint8Array = new Uint8Array(buffer);
        const md5Hash = calculateMd5(uint8Array);
        const sha256Hash = calculateSha256(uint8Array);

        console.log(`Large.bin MD5: ${md5Hash}`);
        console.log(`Large.bin SHA256: ${sha256Hash}`);

        // Verify file is not all zeros (common corruption pattern)
        const hasNonZeroBytes = uint8Array.some((byte) => byte !== 0);
        expect(hasNonZeroBytes).toBe(true);

        // Verify file has some variety (not all same byte)
        const firstByte = uint8Array[0];
        const hasVariety = uint8Array.some((byte) => byte !== firstByte);
        expect(hasVariety).toBe(true);

        // If we have an expected MD5, verify it
        if (EXPECTED_FILES['/large.bin'].expectedMd5) {
          expect(md5Hash).toBe(EXPECTED_FILES['/large.bin'].expectedMd5);
        }
      },
      TIMEOUT
    );

    test('should serve medium binary file correctly', async () => {
      const response = await fetchWithTimeout(`${BASE_URL}/test1m.tmp`);

      expect(response.status).toBe(EXPECTED_FILES['/test1m.tmp'].statusCode);
      expect(response.headers.get('content-type')).toBe(EXPECTED_FILES['/test1m.tmp'].contentType);
      expect(Number.parseInt(response.headers.get('content-length'))).toBe(
        EXPECTED_FILES['/test1m.tmp'].contentLength
      );

      const buffer = await response.arrayBuffer();
      expect(buffer.byteLength).toBe(EXPECTED_FILES['/test1m.tmp'].contentLength);

      // Verify binary integrity
      const uint8Array = new Uint8Array(buffer);
      const md5Hash = calculateMd5(uint8Array);
      console.log(`test1m.tmp MD5: ${md5Hash}`);

      // Basic corruption checks
      const hasNonZeroBytes = uint8Array.some((byte) => byte !== 0);
      expect(hasNonZeroBytes).toBe(true);
    });
  });

  describe('Range Requests (Partial Content)', () => {
    test('should handle simple range request', async () => {
      const response = await fetchWithTimeout(`${BASE_URL}/large.bin`, {
        headers: { range: 'bytes=0-99' },
      });

      expect(response.status).toBe(206); // Partial Content
      expect(response.headers.get('content-type')).toBe('application/octet-stream');
      expect(Number.parseInt(response.headers.get('content-length'))).toBe(100);
      expect(response.headers.get('content-range')).toMatch(/^bytes 0-99\/\d+$/);

      const buffer = await response.arrayBuffer();
      expect(buffer.byteLength).toBe(100);
    });

    test('should handle range request in middle of file', async () => {
      const response = await fetchWithTimeout(`${BASE_URL}/large.bin`, {
        headers: { range: 'bytes=1000-1999' },
      });

      expect(response.status).toBe(206);
      expect(Number.parseInt(response.headers.get('content-length'))).toBe(1000);
      expect(response.headers.get('content-range')).toMatch(/^bytes 1000-1999\/\d+$/);

      const buffer = await response.arrayBuffer();
      expect(buffer.byteLength).toBe(1000);
    });

    test('should handle range request to end of file', async () => {
      const response = await fetchWithTimeout(`${BASE_URL}/large.bin`, {
        headers: { range: 'bytes=10485700-' }, // Last 60 bytes
      });

      expect(response.status).toBe(206);
      expect(Number.parseInt(response.headers.get('content-length'))).toBe(60);
      expect(response.headers.get('content-range')).toMatch(/^bytes 10485700-10485759\/10485760$/);
    });

    test('should handle invalid range request', async () => {
      const response = await fetchWithTimeout(`${BASE_URL}/large.bin`, {
        headers: { range: 'bytes=20000000-30000000' }, // Beyond file size
      });

      expect(response.status).toBe(416); // Range Not Satisfiable
    });

    test('should verify range request data integrity', async () => {
      // Get first 1000 bytes via range request
      const rangeResponse = await fetchWithTimeout(`${BASE_URL}/large.bin`, {
        headers: { range: 'bytes=0-999' },
      });

      expect(rangeResponse.status).toBe(206);
      const rangeBuffer = await rangeResponse.arrayBuffer();

      // Get full file and compare first 1000 bytes
      const fullResponse = await fetchWithTimeout(`${BASE_URL}/large.bin`);
      const fullBuffer = await fullResponse.arrayBuffer();

      const fullFirst1000 = fullBuffer.slice(0, 1000);

      expect(rangeBuffer.byteLength).toBe(fullFirst1000.byteLength);

      // Compare byte by byte
      const rangeBytes = new Uint8Array(rangeBuffer);
      const fullBytes = new Uint8Array(fullFirst1000);

      for (let i = 0; i < rangeBytes.length; i++) {
        expect(rangeBytes[i]).toBe(fullBytes[i]);
      }
    });
  });

  describe('HEAD Requests', () => {
    test('should handle HEAD request for HTML file', async () => {
      const response = await fetchWithTimeout(`${BASE_URL}/index.html`, {
        method: 'HEAD',
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/html');
      expect(Number.parseInt(response.headers.get('content-length'))).toBe(338);

      // HEAD should not return body
      const text = await response.text();
      expect(text).toBe('');
    });

    test('should handle HEAD request for binary file', async () => {
      const response = await fetchWithTimeout(`${BASE_URL}/large.bin`, {
        method: 'HEAD',
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/octet-stream');
      expect(Number.parseInt(response.headers.get('content-length'))).toBe(10485760);

      const buffer = await response.arrayBuffer();
      expect(buffer.byteLength).toBe(0);
    });
  });

  describe('Special Characters and Edge Cases', () => {
    test('should handle special characters in filename', async () => {
      const specialFile = '/specialCharacters!-_.*\'()&$@=;:+  ,?\\{^}%`]">[~<#|.';
      const response = await fetchWithTimeout(`${BASE_URL}${specialFile}`);

      // This might return 200 or 404 depending on whether the file exists in S3
      expect([200, 404]).toContain(response.status);
    });

    test('should handle URL encoding properly', async () => {
      const encodedPath = encodeURIComponent('/test file with spaces.txt');
      const response = await fetchWithTimeout(`${BASE_URL}/${encodedPath}`);

      // Should handle URL encoding gracefully (200 if exists, 404 if not)
      expect([200, 404]).toContain(response.status);
    });

    test('should handle very long URLs', async () => {
      const longPath = `/very-long-filename-${'a'.repeat(200)}.txt`;
      const response = await fetchWithTimeout(`${BASE_URL}${longPath}`);

      // Should handle long URLs gracefully
      expect([200, 404, 414]).toContain(response.status); // 414 = URI Too Long
    });
  });

  describe('HTTP Methods', () => {
    test('should reject POST requests', async () => {
      const response = await fetchWithTimeout(`${BASE_URL}/index.html`, {
        method: 'POST',
      });

      expect([404, 405]).toContain(response.status); // Method Not Allowed or Not Found
    });

    test('should reject PUT requests', async () => {
      const response = await fetchWithTimeout(`${BASE_URL}/index.html`, {
        method: 'PUT',
        body: 'test data',
      });

      expect([404, 405]).toContain(response.status);
    });

    test('should reject DELETE requests', async () => {
      const response = await fetchWithTimeout(`${BASE_URL}/index.html`, {
        method: 'DELETE',
      });

      expect([404, 405]).toContain(response.status);
    });
  });

  describe('Health Check', () => {
    test('should respond to health check', async () => {
      const response = await fetchWithTimeout(`${BASE_URL}/health`);

      expect(response.status).toBe(200);

      const text = await response.text();
      expect(text).toBe('OK');
    });
  });

  describe('Performance and Reliability', () => {
    test('should handle concurrent requests', async () => {
      const promises = Array.from({ length: 10 }, () => fetchWithTimeout(`${BASE_URL}/index.html`));

      const responses = await Promise.all(promises);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });

    test(
      'should handle large file download within reasonable time',
      async () => {
        const startTime = Date.now();
        const response = await fetchWithTimeout(`${BASE_URL}/large.bin`);
        const endTime = Date.now();

        expect(response.status).toBe(200);

        const downloadTime = endTime - startTime;
        console.log(`Large file download time: ${downloadTime}ms`);

        // Should complete within 30 seconds (generous for CI environments)
        expect(downloadTime).toBeLessThan(30000);
      },
      TIMEOUT
    );

    test('should maintain consistent response headers across requests', async () => {
      const responses = await Promise.all([
        fetchWithTimeout(`${BASE_URL}/index.html`),
        fetchWithTimeout(`${BASE_URL}/index.html`),
        fetchWithTimeout(`${BASE_URL}/index.html`),
      ]);

      const headers = responses.map((r) => ({
        contentType: r.headers.get('content-type'),
        contentLength: r.headers.get('content-length'),
      }));

      // All responses should have identical headers
      expect(headers[0]).toEqual(headers[1]);
      expect(headers[1]).toEqual(headers[2]);
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed requests gracefully', async () => {
      const response = await fetchWithTimeout(`${BASE_URL}/../../../etc/passwd`);

      // Should not allow path traversal
      expect([400, 403, 404]).toContain(response.status);
    });

    test('should handle requests with invalid headers', async () => {
      const response = await fetchWithTimeout(`${BASE_URL}/index.html`, {
        headers: {
          range: 'invalid-range-header',
        },
      });

      // Should handle invalid range header gracefully
      expect([200, 400, 416]).toContain(response.status);
    });
  });
});
