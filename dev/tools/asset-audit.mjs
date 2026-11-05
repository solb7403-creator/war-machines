// Read-only LUNAR asset inventory and integrity checker. Node 22+, no dependencies.
// Run from any directory: node dev/tools/asset-audit.mjs [--json]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MANIFEST = 'js/assets/hf-v1/manifest.json';
const ASSET_DIRS = ['js/assets', 'web/assets', 'img'];
const MAX_REPORTED = 8;

export function auditManifest(root = ROOT, manifestRel = MANIFEST) {
  const errors = [];
  let checked = 0;
  let bytes = 0;
  let manifest;
  const manifestPath = resolve(root, manifestRel);
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    return { checked, bytes, errors: [`Cannot read manifest ${manifestRel}: ${error.message}`] };
  }
  if (!manifest || !Array.isArray(manifest.files)) {
    return { checked, bytes, errors: ['Manifest files must be an array'] };
  }
  const base = resolve(root, 'js/assets/hf-v1');
  const seen = new Set();
  for (const entry of manifest.files) {
    const name = entry?.file;
    if (typeof name !== 'string' || !name || name.includes('\\') || name.startsWith('/') || name.split('/').includes('..')) {
      errors.push(`Unsafe or missing asset name: ${String(name)}`);
      continue;
    }
    if (seen.has(name)) { errors.push(`Duplicate manifest entry: ${name}`); continue; }
    seen.add(name);
    const path = resolve(base, name);
    if (!(path.startsWith(base + sep))) { errors.push(`Asset escapes its directory: ${name}`); continue; }
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || !/^[a-f0-9]{64}$/.test(String(entry.sha256))) {
      errors.push(`Invalid expected bytes/hash for ${name}`); continue;
    }
    try {
      const data = readFileSync(path);
      checked++; bytes += data.length;
      if (data.length !== entry.bytes) errors.push(`Size mismatch: ${name} expected ${entry.bytes}, found ${data.length}`);
      const actual = createHash('sha256').update(data).digest('hex');
      if (actual !== entry.sha256) errors.push(`SHA-256 mismatch: ${name}`);
    } catch (error) {
      errors.push(`Cannot read ${name}: ${error.message}`);
    }
  }
  return { checked, bytes, errors };
}

export function inventoryAssets(root = ROOT) {
  const files = [];
  for (const relDir of ASSET_DIRS) {
    const dir = resolve(root, relDir);
    try { if (!statSync(dir).isDirectory()) continue; } catch { continue; }
    const visit = location => {
      for (const item of readdirSync(location, { withFileTypes: true })) {
        const path = join(location, item.name);
        if (item.isDirectory()) visit(path);
        else if (item.isFile()) files.push({ file: relative(root, path).replaceAll('\\', '/'), bytes: statSync(path).size });
      }
    };
    visit(dir);
  }
  const totalBytes = files.reduce((sum, item) => sum + item.bytes, 0);
  const largest = files.sort((a, b) => b.bytes - a.bytes).slice(0, MAX_REPORTED);
  return { count: files.length, totalBytes, largest };
}

function main() {
  const manifest = auditManifest();
  const inventory = inventoryAssets();
  const report = { atlasIntegrity: manifest, assetInventory: inventory };
  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`LUNAR assets: ${inventory.count} files, ${(inventory.totalBytes / 1048576).toFixed(2)} MiB`);
    console.log(`PBR manifest: ${manifest.checked} validated files, ${manifest.errors.length} error(s)`);
    for (const item of inventory.largest) console.log(`  ${(item.bytes / 1048576).toFixed(2)} MiB  ${item.file}`);
    for (const error of manifest.errors) console.error('ERROR:', error);
  }
  if (manifest.errors.length) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
