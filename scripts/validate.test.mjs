import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRootNode, channelPairs, findDeletions } from './validate.mjs';

test('valid root produces no errors', () => {
  assert.deepEqual(validateRootNode({
    code: 'de', name: 'Germany',
    channels: [
      { channel: '#bots', description: 'Bot Channel' },
      { channel: '#hansemesh', description: 'Greater Hamburg Area' },
    ],
  }, 'de'), []);
});

test('flags filename/code mismatch', () => {
  const errs = validateRootNode({ code: 'de', name: 'Germany', channels: [] }, 'fr');
  assert.equal(errs.length, 1);
  assert.match(errs[0], /code "de" does not match filename stem "fr"/);
});

test('flags non-single-segment root code', () => {
  const errs = validateRootNode({ code: 'de-hh', name: 'X', channels: [] }, 'de-hh');
  assert.ok(errs.some((e) => /root code/.test(e)));
});

test('flags unsorted channels', () => {
  const errs = validateRootNode({ code: 'de', name: 'Germany', channels: [
    { channel: '#hansemesh', description: 'A' },
    { channel: '#bots', description: 'B' },
  ]}, 'de');
  assert.ok(errs.some((e) => /not sorted/.test(e)));
});

test('flags duplicate channels', () => {
  const errs = validateRootNode({ code: 'de', name: 'Germany', channels: [
    { channel: '#bots', description: 'A' },
    { channel: '#bots', description: 'B' },
  ]}, 'de');
  assert.ok(errs.some((e) => /duplicate channel "#bots"/.test(e)));
});

test('flags bad channel pattern', () => {
  const errs = validateRootNode({ code: 'de', name: 'Germany', channels: [
    { channel: '#bad channel', description: 'A' },
  ]}, 'de');
  assert.ok(errs.some((e) => /invalid channel/.test(e)));
});

test('uppercase in a channel is rejected', () => {
  const errs = validateRootNode({ code: 'de', name: 'Germany', channels: [
    { channel: '#LongFast', description: 'LongFast' },
  ]}, 'de');
  assert.ok(errs.some((e) => /invalid channel/.test(e)));
});

test('flags unknown channel key', () => {
  const errs = validateRootNode({ code: 'de', name: 'Germany', channels: [
    { channel: '#bots', description: 'A', color: 'red' },
  ]}, 'de');
  assert.ok(errs.some((e) => /unexpected key "color"/.test(e)));
});

test('flags bad key', () => {
  const errs = validateRootNode({ code: 'de', name: 'Germany', channels: [
    { channel: '#bots', description: 'A', key: 'not-base64' },
  ]}, 'de');
  assert.ok(errs.some((e) => /invalid key/.test(e)));
});

test('non-hashtag channel without a key is flagged', () => {
  const errs = validateRootNode({ code: 'de', name: 'Germany', channels: [
    { channel: 'public', description: 'Public' },
  ]}, 'de');
  assert.ok(errs.some((e) => /non-hashtag channel "public" requires a key/.test(e)));
});

test('non-hashtag channel with a valid key passes', () => {
  const errs = validateRootNode({ code: 'de', name: 'Germany', channels: [
    { channel: 'public', description: 'Public', key: 'izOH6cXN6mrJ5e26oRXNcg==' },
  ]}, 'de');
  assert.deepEqual(errs, []);
});

test('hashtag channel without a key is allowed', () => {
  const errs = validateRootNode({ code: 'de', name: 'Germany', channels: [
    { channel: '#bots', description: 'Bot Channel' },
  ]}, 'de');
  assert.deepEqual(errs, []);
});

test('channelPairs lists country:channel pairs from a tree', () => {
  const pairs = channelPairs([
    { code: 'de', name: 'Germany', channels: [{ channel: '#bots', description: 'A' }] },
    { code: 'nl', name: 'Netherlands', channels: [{ channel: '#bots', description: 'B' }] },
  ]);
  assert.deepEqual([...pairs].sort(), ['de #bots', 'nl #bots']);
});

test('findDeletions reports pairs missing from head', () => {
  const base = [{ code: 'de', name: 'Germany', channels: [
    { channel: '#bots', description: 'A' }, { channel: '#old', description: 'B' },
  ]}];
  const head = [{ code: 'de', name: 'Germany', channels: [
    { channel: '#bots', description: 'A' },
  ]}];
  assert.deepEqual(findDeletions(base, head), ['de #old']);
});

test('findDeletions allows adding the same channel to another country', () => {
  const base = [{ code: 'de', name: 'Germany', channels: [{ channel: '#bots', description: 'A' }] }];
  const head = [
    { code: 'de', name: 'Germany', channels: [{ channel: '#bots', description: 'A' }] },
    { code: 'nl', name: 'Netherlands', channels: [{ channel: '#bots', description: 'B' }] },
  ];
  assert.deepEqual(findDeletions(base, head), []);
});
