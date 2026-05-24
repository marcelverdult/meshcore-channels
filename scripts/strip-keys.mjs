#!/usr/bin/env node
// Rewrites channels/*.json, removing the `key` field from any hashtag channel
// (the `channel` field starts with '#'). A hashtag channel's key is derived by the consuming
// app and must never be stored. Run on merge to main so a contributor PR that
// includes a key on a hashtag channel is cleaned up automatically.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CHANNELS_DIR = join(ROOT, 'channels');

let stripped = 0;
let changedFiles = 0;
for (const file of readdirSync(CHANNELS_DIR).filter((f) => f.endsWith('.json')).sort()) {
  const path = join(CHANNELS_DIR, file);
  const raw = readFileSync(path, 'utf8');
  let node;
  try {
    node = JSON.parse(raw);
  } catch (e) {
    throw new Error(`channels/${file}: JSON parse error: ${e.message}`);
  }
  let changed = false;
  for (const ch of node.channels || []) {
    if (ch && typeof ch.channel === 'string' && ch.channel.startsWith('#') && 'key' in ch) {
      delete ch.key;
      stripped++;
      changed = true;
    }
  }
  if (changed) {
    writeFileSync(path, JSON.stringify(node, null, 2) + '\n');
    changedFiles++;
  }
}
console.log(`strip-keys: removed ${stripped} key(s) from ${changedFiles} file(s)`);
