import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderStatusBlock } from './update-readme-status.mjs';

test('renderStatusBlock replaces content between markers', () => {
  const md = [
    'intro',
    '<!-- channels:auto-status:begin -->',
    'OLD',
    '<!-- channels:auto-status:end -->',
    'outro',
  ].join('\n');
  const out = renderStatusBlock(md, {
    generated_at: '2026-05-21T00:00:00Z',
    roots: 252,
    channels: 762,
    unique: 700,
  });
  assert.match(out, /Last build: `2026-05-21T00:00:00Z`/);
  assert.match(out, /Roots: 252/);
  assert.match(out, /Channels: 762/);
  assert.match(out, /Unique channels: 700/);
  assert.ok(!out.includes('OLD'));
  assert.ok(out.startsWith('intro\n'));
  assert.ok(out.endsWith('\noutro'));
});

test('renderStatusBlock leaves text unchanged when markers absent', () => {
  const md = 'no markers here';
  assert.equal(renderStatusBlock(md, { generated_at: 'x', roots: 0, channels: 0, unique: 0 }), md);
});
