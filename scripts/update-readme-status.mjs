#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CHANNELS_DIR = join(ROOT, 'channels');
const BY_COUNTRY_PATH = join(ROOT, 'channels-by-country.json');
const UNIQUE_PATH = join(ROOT, 'channels-unique.json');
const BEGIN = '<!-- channels:auto-status:begin -->';
const END = '<!-- channels:auto-status:end -->';

// Replace the text between the auto-status markers in `md` with a fresh status
// block built from `stats` ({ generated_at, roots, channels, unique }). If the
// markers are absent, return `md` unchanged.
export function renderStatusBlock(md, stats) {
  const start = md.indexOf(BEGIN);
  const end = md.indexOf(END);
  if (start === -1 || end === -1 || end < start) return md;
  const block = [
    BEGIN,
    '',
    `- Last build: \`${stats.generated_at}\``,
    `- Roots: ${stats.roots}`,
    `- Channels: ${stats.channels}`,
    `- Unique channels: ${stats.unique}`,
    '',
    END,
  ].join('\n');
  return md.slice(0, start) + block + md.slice(end + END.length);
}

function main() {
  const readmePath = join(ROOT, 'README.md');
  const byCountry = JSON.parse(readFileSync(BY_COUNTRY_PATH, 'utf8'));
  const unique = JSON.parse(readFileSync(UNIQUE_PATH, 'utf8'));
  const roots = readdirSync(CHANNELS_DIR).filter((f) => f.endsWith('.json')).length;
  const stats = {
    generated_at: byCountry.generated_at,
    roots,
    channels: Object.values(byCountry.countries).reduce((n, a) => n + a.length, 0),
    unique: unique.channels.length,
  };
  const md = readFileSync(readmePath, 'utf8');
  const next = renderStatusBlock(md, stats);
  if (next !== md) {
    writeFileSync(readmePath, next);
    console.log('README status block updated');
  } else {
    console.log('README status block unchanged');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
