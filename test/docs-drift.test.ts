import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Guards against docs silently drifting from the values this repo owns, and
// against a stale cross-repo version pin creeping back into the README.
const root = new URL('../', import.meta.url);
const readme = readFileSync(new URL('README.md', root), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('docs stay in sync with package.json', () => {
  it('README states the same Node baseline as engines.node', () => {
    const minNode = pkg.engines.node.replace(/^\D*/, ''); // ">=22.13.0" -> "22.13.0"
    expect(minNode).toMatch(/^\d+\.\d+\.\d+$/);
    // The README's "Node.js" requirement line must mention that exact minimum,
    // so a bump to engines.node fails this test until the README is updated.
    expect(readme).toMatch(new RegExp(`Node\\.js[^\\n]*${escapeRe(minNode)}`));
  });

  it('README does not pin a patch version of the cross-repo Docker image', () => {
    // forkzero/s3proxy:X.Y.Z is owned by forkzero/s3proxy-docker (a separate
    // repo/release), so a patch pin here goes stale. Use :latest or a rolling
    // :X.Y tag in docs instead.
    const patchPins = readme.match(/forkzero\/s3proxy:\d+\.\d+\.\d+/g) ?? [];
    expect(patchPins).toEqual([]);
  });
});
