#!/usr/bin/env node
// Maintainer tool. Seeds channels/<code>.json for every country root present in
// a local meshcore-regions checkout. Never overwrites an existing root and
// never deletes — channels already catalogued are preserved.
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CHANNELS_DIR = join(ROOT, 'channels');
const regionsDir = process.argv[2]
  || process.env.MESHCORE_REGIONS_DIR
  || join(ROOT, '..', 'meshcore-regions');
const REGIONS = join(regionsDir, 'regions');

if (!existsSync(REGIONS)) {
  console.error(`regions directory not found: ${REGIONS}`);
  process.exit(1);
}
mkdirSync(CHANNELS_DIR, { recursive: true });

let created = 0;
let skipped = 0;
for (const file of readdirSync(REGIONS).filter((f) => f.endsWith('.json')).sort()) {
  const stem = basename(file, '.json');
  const dest = join(CHANNELS_DIR, file);
  if (existsSync(dest)) { skipped++; continue; }
  const region = JSON.parse(readFileSync(join(REGIONS, file), 'utf8'));
  const root = { code: region.code, name: region.name, channels: [] };
  if (root.code !== stem) {
    console.error(`skip ${file}: code "${root.code}" does not match filename`);
    continue;
  }
  writeFileSync(dest, JSON.stringify(root, null, 2) + '\n');
  created++;
}
console.log(`sync-roots: ${created} created, ${skipped} preserved`);
