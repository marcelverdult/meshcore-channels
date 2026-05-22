# meshcore-channels

Canonical, community-editable catalog of MeshCore channels, organized by country.

## What this is

A JSON catalog of named MeshCore channels grouped under country roots. Each
country file lists its channels as
`{ "channel": "#name", "description": "Display Label" }`. The catalog is the
channel-level companion to
[meshcore-regions](https://github.com/marcelverdult/meshcore-regions).

## How to consume

Stable raw URLs:

- Channels grouped by country:
  `https://raw.githubusercontent.com/marcelverdult/meshcore-channels/main/channels-by-country.json`
- De-duplicated flat list (one entry per unique `channel`):
  `https://raw.githubusercontent.com/marcelverdult/meshcore-channels/main/channels-unique.json`
- One country at a time:
  `https://raw.githubusercontent.com/marcelverdult/meshcore-channels/main/channels/<code>.json`

- `channels-by-country.json` —
  `{ "generated_at": "...", "license": "CC0-1.0", "countries": { ... } }`.
  `countries` is an object keyed by country `code` (all 252 roots present); each
  value is that country's channel array of `{ channel, description }`, plus
  `key` for non-hashtag channels, sorted by `channel`.
- `channels-unique.json` —
  `{ "generated_at": "...", "license": "CC0-1.0", "channels": [ ... ] }`.
  One entry per unique `channel`, `{ channel, description }` plus `key` for
  non-hashtag channels, sorted by `channel`. When a channel appears under
  several countries the first (countries in `code` order) wins.

## Channel keys

A record's `channel` value decides whether it carries a key:

- **Hashtag channels** — `channel` starts with `#` (e.g. `#hansemesh`). The key
  is not stored in this catalog; a consuming app derives it from the channel
  name. A `key` on a hashtag channel is stripped automatically when a PR merges
  to `main`.
- **Non-hashtag channels** — `channel` has no `#` (e.g. `public`). The key
  cannot be derived, so the country file must carry an explicit `key`: base64
  of a 16-byte channel key.

The build does not generate keys — it passes through whatever the source
files contain. A hashtag-channel record only needs `channel` + `description`.

## How to contribute

Pull requests may only modify files matching `channels/*.json`.

Rules enforced automatically by CI:

- **No new country roots.** The 252 roots (250 ISO 3166-1 alpha-2 codes plus
  `sco` and `ioi`) are already seeded; if you need another root, open an issue.
- **No deletions.** Once a channel is catalogued under a country it stays.
- **A channel may appear under several countries.** Adding `#bots` to another
  country is a normal addition, not a move.
- **Adding channels and editing names or keys is free** — no label required.
- **Lowercase only.** A `channel` value contains only lowercase letters,
  digits, and hyphens. Uppercase is rejected by CI.
- A `channel` value is an optional leading `#`, then hyphen-separated
  `[a-z0-9]` segments, each segment capped at 29 characters to fit the MeshCore
  firmware name buffer. A `#` channel is a hashtag channel (`key` may be
  omitted); a channel with no `#` must carry an explicit `key`.
- Channels within a country file are sorted by `channel`.

The generated lists (`channels-by-country.json`, `channels-unique.json`),
scripts, schemas, workflows, and this README are maintained by repository
maintainers and the build automation.

## Last updates

<!-- channels:auto-status:begin -->

- Last build: `2026-05-21T22:23:57Z`
- Roots: 252
- Channels: 754
- Unique channels: 733

<!-- channels:auto-status:end -->

## License

[CC0 1.0 Universal](LICENSE) — this catalog is dedicated to the public domain.
Use it for anything, no attribution required.
