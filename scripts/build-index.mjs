#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CHANNELS_DIR = join(ROOT, 'channels');
const BY_COUNTRY_PATH = join(ROOT, 'channels-by-country.json');
const UNIQUE_PATH = join(ROOT, 'channels-unique.json');

// SPDX license identifier embedded in every generated dataset file.
const LICENSE = 'CC0-1.0';

// True when `channel` is a hashtag channel (leading '#'). A hashtag channel's
// key is derived by the consuming app and is never stored or emitted.
export function isHashtag(channel) {
  return typeof channel === 'string' && channel.startsWith('#');
}

// Normalize a source channel record to its output form: keep `channel` and
// `description`, keep `key` ONLY for non-hashtag channels. A hashtag channel's
// key is dropped.
export function normalizeChannel(ch) {
  const out = { channel: ch.channel, description: ch.description };
  if (!isHashtag(ch.channel) && typeof ch.key === 'string' && ch.key.length > 0) {
    out.key = ch.key;
  }
  return out;
}

// Normalize a country root: keep only known keys, sort channels by `channel`.
export function normalizeRoot(node) {
  const channels = Array.isArray(node.channels) ? node.channels : [];
  const sorted = [...channels].sort((a, b) => a.channel.localeCompare(b.channel));
  return {
    code: node.code,
    name: node.name,
    channels: sorted.map(normalizeChannel),
  };
}

// Channels grouped by country: an object keyed by country `code`, each value
// the country's normalized channel array (sorted by `channel`). Every country
// root appears, including those with no channels. Keys are in `code` order.
export function buildByCountry(tree) {
  const out = {};
  for (const root of [...tree].sort((a, b) => a.code.localeCompare(b.code))) {
    out[root.code] = root.channels;
  }
  return out;
}

// De-duplicated list, one entry per unique `channel`, country dropped. When a
// channel appears under several countries the first occurrence (countries in
// code order) wins. Sorted by `channel`.
export function buildUnique(tree) {
  const byChannel = new Map();
  for (const root of [...tree].sort((a, b) => a.code.localeCompare(b.code))) {
    for (const ch of root.channels) {
      if (byChannel.has(ch.channel)) continue;
      const entry = { channel: ch.channel, description: ch.description };
      if (typeof ch.key === 'string') entry.key = ch.key;
      byChannel.set(ch.channel, entry);
    }
  }
  return [...byChannel.values()].sort((a, b) => a.channel.localeCompare(b.channel));
}

// Read every channels/*.json (sorted by filename), verify filename stem equals
// `code`, and return normalized roots.
export function loadTree() {
  const files = readdirSync(CHANNELS_DIR).filter((f) => f.endsWith('.json')).sort();
  const tree = [];
  for (const file of files) {
    const stem = basename(file, '.json');
    const raw = readFileSync(join(CHANNELS_DIR, file), 'utf8');
    let node;
    try {
      node = JSON.parse(raw);
    } catch (e) {
      throw new Error(`channels/${file}: JSON parse error: ${e.message}`);
    }
    if (node.code !== stem) {
      throw new Error(`filename/code mismatch: ${file} has code "${node.code}"`);
    }
    tree.push(normalizeRoot(node));
  }
  return tree;
}

function isoStamp() {
  return process.env.SOURCE_DATE_EPOCH
    ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z')
    : new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// Write { generated_at, license, [payloadKey]: value } to `path`, but ONLY
// when `value` (or the embedded license) differs from what the file already
// holds. When the data is unchanged the file is left byte-for-byte intact —
// including its existing `generated_at` — so a no-op rebuild (e.g. the nightly
// run) produces no commit and does not invalidate consumers' ETag / HTTP
// caching.
function writeIfChanged(path, payloadKey, value, generatedAt) {
  let existing;
  try {
    existing = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    existing = null;
  }
  if (existing
    && existing.license === LICENSE
    && JSON.stringify(existing[payloadKey]) === JSON.stringify(value)) {
    return false;
  }
  const next = { generated_at: generatedAt, license: LICENSE, [payloadKey]: value };
  writeFileSync(path, JSON.stringify(next, null, 2) + '\n');
  return true;
}

function main() {
  const tree = loadTree();
  const generatedAt = isoStamp();
  const byCountry = buildByCountry(tree);
  const unique = buildUnique(tree);
  const wroteByCountry = writeIfChanged(BY_COUNTRY_PATH, 'countries', byCountry, generatedAt);
  const wroteUnique = writeIfChanged(UNIQUE_PATH, 'channels', unique, generatedAt);
  const channelCount = Object.values(byCountry).reduce((n, a) => n + a.length, 0);
  console.log(
    `channels-by-country.json (${channelCount} channels, ${Object.keys(byCountry).length} countries) ` +
    `${wroteByCountry ? 'updated' : 'unchanged'}; ` +
    `channels-unique.json (${unique.length} unique) ${wroteUnique ? 'updated' : 'unchanged'}`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
