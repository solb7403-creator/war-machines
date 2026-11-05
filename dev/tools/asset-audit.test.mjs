import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { auditManifest, inventoryAssets } from './asset-audit.mjs';

function fixture(fn) {
  const root = mkdtempSync(join(tmpdir(), 'lunar-assets-'));
  try {
    const dir = join(root, 'js/assets/hf-v1');
    mkdirSync(dir, { recursive: true });
    const data = Buffer.from('original-asset-data');
    writeFileSync(join(dir, 'base-high.png'), data);
    const entry = { file: 'base-high.png', bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
    const write = entries => writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ version: 'test', files: entries }));
    write([entry]);
    fn({ root, dir, entry, write });
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test('valid manifest matches bytes and SHA-256', () => fixture(({ root }) => {
  assert.deepEqual(auditManifest(root).errors, []);
  assert.equal(auditManifest(root).checked, 1);
  assert.equal(inventoryAssets(root).count, 2);
}));

test('corrupted bytes are reported', () => fixture(({ root, dir }) => {
  writeFileSync(join(dir, 'base-high.png'), 'modified-asset-data');
  assert.ok(auditManifest(root).errors.some(x => x.includes('SHA-256 mismatch')));
}));

test('incorrect sizes are reported', () => fixture(({ root, entry, write }) => {
  write([{ ...entry, bytes: 1 }]);
  assert.ok(auditManifest(root).errors.some(x => x.includes('Size mismatch')));
}));

test('manifest traversal and duplicate names are rejected', () => fixture(({ root, entry, write }) => {
  write([{ ...entry, file: '../outside.txt' }, entry, entry]);
  const errors = auditManifest(root).errors;
  assert.ok(errors.some(x => x.includes('Unsafe')));
  assert.ok(errors.some(x => x.includes('Duplicate')));
}));
