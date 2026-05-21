#!/usr/bin/env node
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { loadTree } from './build-index.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CHANNELS_DIR = join(ROOT, 'channels');

// Segment length 29: firmware name buffer char name[31], minus the NUL
// terminator and the byte reserved for the implicit '#' prefix.
const MAX_SEGMENT_LEN = 29;
const ROOT_CODE_RE = new RegExp(`^[a-z0-9]{1,${MAX_SEGMENT_LEN}}$`);
// Channel: optional leading '#', then hyphen-separated lowercase segments.
// With '#' it is a hashtag channel (key derived in the consuming app, so `key`
// may be omitted here). Without '#' it is a non-hashtag channel and an
// explicit `key` is mandatory.
const CHANNEL_RE = new RegExp(`^#?[a-z0-9]{1,${MAX_SEGMENT_LEN}}(-[a-z0-9]{1,${MAX_SEGMENT_LEN}})*$`);
const KEY_RE = /^[A-Za-z0-9+/]{22}==$/;

// Validate one country-root object against the schema rules. `stem` is the
// filename without extension. Returns an array of human-readable error strings.
export function validateRootNode(node, stem) {
  const errors = [];
  const at = `channels/${stem}.json`;
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return [`${at}: root is not an object`];
  }
  if (typeof node.code !== 'string' || !ROOT_CODE_RE.test(node.code)) {
    errors.push(`${at}: invalid root code "${node.code}" (must be a single [a-z0-9] segment)`);
  }
  if (typeof node.code === 'string' && node.code !== stem) {
    errors.push(`${at}: code "${node.code}" does not match filename stem "${stem}"`);
  }
  if (typeof node.name !== 'string' || node.name.length === 0 || node.name.length > 200) {
    errors.push(`${at}: missing or invalid name`);
  }
  for (const k of Object.keys(node)) {
    if (!['code', 'name', 'channels'].includes(k)) {
      errors.push(`${at}: unexpected key "${k}" at root`);
    }
  }
  if (!Array.isArray(node.channels)) {
    errors.push(`${at}: channels must be an array`);
    return errors;
  }
  const chans = [];
  for (const ch of node.channels) {
    if (!ch || typeof ch !== 'object' || Array.isArray(ch)) {
      errors.push(`${at}: channel entry is not an object`);
      continue;
    }
    if (typeof ch.channel !== 'string' || !CHANNEL_RE.test(ch.channel)) {
      errors.push(`${at}: invalid channel "${ch.channel}"`);
    } else {
      chans.push(ch.channel);
    }
    if (typeof ch.description !== 'string' || ch.description.length === 0 || ch.description.length > 200) {
      errors.push(`${at}: missing or invalid description for channel "${ch.channel}"`);
    }
    if ('key' in ch && (typeof ch.key !== 'string' || !KEY_RE.test(ch.key))) {
      errors.push(`${at}: invalid key for channel "${ch.channel}"`);
    }
    const hasKey = typeof ch.key === 'string' && ch.key.length > 0;
    if (typeof ch.channel === 'string' && !ch.channel.startsWith('#') && !hasKey) {
      errors.push(`${at}: non-hashtag channel "${ch.channel}" requires a key`);
    }
    for (const k of Object.keys(ch)) {
      if (!['channel', 'description', 'key'].includes(k)) {
        errors.push(`${at}: unexpected key "${k}" at channel "${ch.channel}"`);
      }
    }
  }
  const dupSeen = new Set();
  for (const c of chans) {
    if (dupSeen.has(c)) errors.push(`${at}: duplicate channel "${c}"`);
    dupSeen.add(c);
  }
  const sorted = [...chans].sort((a, b) => a.localeCompare(b));
  for (let i = 0; i < chans.length; i++) {
    if (chans[i] !== sorted[i]) {
      errors.push(`${at}: channels not sorted by channel`);
      break;
    }
  }
  return errors;
}

// A channel's identity is the (country, channel) pair, joined by a space;
// neither field can contain a space.
export function channelPairs(tree) {
  const set = new Set();
  for (const root of tree) {
    for (const ch of root.channels || []) {
      set.add(`${root.code} ${ch.channel}`);
    }
  }
  return set;
}

// (country, channel) pairs present in base but absent from head — forbidden.
export function findDeletions(baseTree, headTree) {
  const head = channelPairs(headTree);
  const removed = [];
  for (const pair of channelPairs(baseTree)) {
    if (!head.has(pair)) removed.push(pair);
  }
  return removed.sort();
}

function loadTreeAtRef(ref) {
  const lsTree = execSync(`git ls-tree --name-only ${ref} channels/`, { encoding: 'utf8' });
  const files = lsTree.split('\n').map((s) => s.trim()).filter((s) => s.endsWith('.json'));
  return files.map((file) => JSON.parse(execSync(`git show ${ref}:${file}`, { encoding: 'utf8' })));
}

function checkRegions(errors) {
  if (!existsSync(CHANNELS_DIR)) { errors.push('channels/ directory missing'); return; }
  for (const file of readdirSync(CHANNELS_DIR).filter((f) => f.endsWith('.json'))) {
    const stem = basename(file, '.json');
    let node;
    try {
      node = JSON.parse(readFileSync(join(CHANNELS_DIR, file), 'utf8'));
    } catch (e) {
      errors.push(`channels/${file}: JSON parse error: ${e.message}`);
      continue;
    }
    errors.push(...validateRootNode(node, stem));
  }
}

function checkPrScope(errors) {
  const list = process.env.GH_CHANGED_FILES;
  if (!list) return;
  if (process.env.GH_PR_AUTHOR === 'github-actions[bot]') return;
  const files = list.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const allow = /^channels\/[a-z0-9]+\.json$/;
  const baseRef = process.env.GH_BASE_REF;
  for (const f of files) {
    if (!allow.test(f)) {
      errors.push(`PR scope: path "${f}" not allowed; only channels/*.json may change`);
      continue;
    }
    if (baseRef) {
      try {
        execSync(`git cat-file -e ${baseRef}:${f}`, { stdio: 'ignore' });
      } catch {
        errors.push(`PR scope: new root file "${f}" is not allowed; new country roots are added by maintainers only`);
      }
    }
  }
}

function checkDiffGuard(errors) {
  const baseRef = process.env.GH_BASE_REF;
  if (!baseRef) return;
  let baseTree;
  try {
    baseTree = loadTreeAtRef(baseRef);
  } catch (e) {
    errors.push(`diff guard: cannot load base ref ${baseRef}: ${e.message}`);
    return;
  }
  const headTree = loadTree();
  for (const pair of findDeletions(baseTree, headTree)) {
    const [country, channel] = pair.split(' ');
    errors.push(`diff guard: deletion of channel "${channel}" under "${country}" is not allowed`);
  }
}

function main() {
  const errors = [];
  checkRegions(errors);
  checkPrScope(errors);
  checkDiffGuard(errors);
  if (errors.length > 0) {
    for (const e of errors) console.error(`ERROR: ${e}`);
    console.error(`\n${errors.length} validation error(s).`);
    process.exit(1);
  }
  console.log('validation OK');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
