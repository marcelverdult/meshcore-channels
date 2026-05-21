import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isHashtag, normalizeChannel, normalizeRoot, buildByCountry, buildUnique } from './build-index.mjs';

test('isHashtag is true only for #-prefixed channels', () => {
  assert.equal(isHashtag('#bots'), true);
  assert.equal(isHashtag('public'), false);
});

test('normalizeChannel keeps channel and description, drops unknown keys', () => {
  assert.deepEqual(
    normalizeChannel({ channel: '#bots', description: 'Bot Channel', extra: 1 }),
    { channel: '#bots', description: 'Bot Channel' },
  );
});

test('normalizeChannel strips key from a hashtag channel', () => {
  const out = normalizeChannel({ channel: '#bots', description: 'Bot Channel', key: 'izOH6cXN6mrJ5e26oRXNcg==' });
  assert.deepEqual(out, { channel: '#bots', description: 'Bot Channel' });
});

test('normalizeChannel keeps key on a non-hashtag channel', () => {
  assert.deepEqual(
    normalizeChannel({ channel: 'public', description: 'Public', key: 'izOH6cXN6mrJ5e26oRXNcg==' }),
    { channel: 'public', description: 'Public', key: 'izOH6cXN6mrJ5e26oRXNcg==' },
  );
});

test('normalizeRoot sorts channels by the channel field', () => {
  const out = normalizeRoot({
    code: 'de', name: 'Germany',
    channels: [
      { channel: '#hansemesh', description: 'Greater Hamburg Area' },
      { channel: '#bots', description: 'Bot Channel' },
    ],
  });
  assert.deepEqual(out.channels.map((c) => c.channel), ['#bots', '#hansemesh']);
});

test('normalizeRoot drops unknown keys and tolerates missing channels', () => {
  const out = normalizeRoot({ code: 'aq', name: 'Antarctica', extra: 1 });
  assert.deepEqual(out, { code: 'aq', name: 'Antarctica', channels: [] });
});

test('buildByCountry groups channels into an object keyed by country code', () => {
  const tree = [
    normalizeRoot({ code: 'de', name: 'Germany', channels: [{ channel: '#bots', description: 'Bot Channel' }] }),
    normalizeRoot({ code: 'nl', name: 'Netherlands', channels: [
      { channel: 'public', description: 'Public', key: 'izOH6cXN6mrJ5e26oRXNcg==' },
      { channel: '#bots', description: 'Bots NL' },
    ]}),
    normalizeRoot({ code: 'aq', name: 'Antarctica', channels: [] }),
  ];
  assert.deepEqual(buildByCountry(tree), {
    aq: [],
    de: [{ channel: '#bots', description: 'Bot Channel' }],
    nl: [
      { channel: '#bots', description: 'Bots NL' },
      { channel: 'public', description: 'Public', key: 'izOH6cXN6mrJ5e26oRXNcg==' },
    ],
  });
});

test('buildUnique de-duplicates by channel, drops country, sorts by channel', () => {
  const tree = [
    normalizeRoot({ code: 'de', name: 'Germany', channels: [{ channel: '#bots', description: 'Bot Channel' }] }),
    normalizeRoot({ code: 'nl', name: 'Netherlands', channels: [
      { channel: '#bots', description: 'Bots NL' },
      { channel: '#amsterdam', description: 'Amsterdam' },
    ]}),
  ];
  assert.deepEqual(buildUnique(tree), [
    { channel: '#amsterdam', description: 'Amsterdam' },
    { channel: '#bots', description: 'Bot Channel' },
  ]);
});

test('buildUnique keeps key on a non-hashtag unique entry', () => {
  const tree = [
    normalizeRoot({ code: 'nl', name: 'Netherlands', channels: [
      { channel: 'public', description: 'Public', key: 'izOH6cXN6mrJ5e26oRXNcg==' },
    ]}),
  ];
  assert.deepEqual(buildUnique(tree), [
    { channel: 'public', description: 'Public', key: 'izOH6cXN6mrJ5e26oRXNcg==' },
  ]);
});
