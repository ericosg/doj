# Dungeon of Jev

Turn-based dungeon crawler (Phaser 4.2.1, browser) where every enemy is chosen and played by
Jev, TypeSafe's System One model. Five rooms, one duel per room; warrior or wizard on both sides.

**Use the TypeSafe skill (`typesafe:typesafe-ai`) and the live docs (https://docs.typesafe.ai/llms.txt)
for any Jev work.** Phaser 4 ships agent docs in `node_modules/phaser/skills/` — read those, not v3 memory
(e.g. `textures.generate` is gone; `setTintFill` is now `setTint().setTintMode(Phaser.TintModes.FILL)`).

## Layout
- `server.ts` — Bun.serve: serves `index.html` (Bun bundles the client) and the Jev proxy API.
- `src/shared/rules.ts` — classes, moves, deterministic combat. Used by BOTH the browser and the server.
- `src/server/jev.ts` — builds Jev requests. One Choice question per decision.
- `src/client/` — Phaser scenes (`title` → `map` → `battle` → `end`), FF-style UI, pixel sprites drawn from char maps.

## Jev design rules (from TypeSafe docs — keep them)
- Code does all arithmetic; Jev gets per-option *outcomes* in the criteria ("player HP 34 -> 14", "DEFEATS THE PLAYER").
- Choice options are shuffled every call (jev-1.13 leans toward the first option).
- The API key lives only on the server (`.env`, `TYPESAFE_API_KEY`). The browser calls `/api/enemy/*`.
- If Jev is unreachable the client falls back to a greedy AI and the "Jev's mind" panel says so.

## Gotcha
`@typesafe-ai/sdk` 0.7.0 fails under Bun (incl. 1.4.3) with "Body already used"; 0.6.0 works. Root cause is a
Bun bug (oven-sh/bun#45306: `getReader()`+`releaseLock()` marks a body used), triggered by 0.7.0's new
`bufferResponse` (tracked in typesafe-ai/typesafe-sdk-js#20). So `src/server/jev.ts` calls `POST /v1/systemone` directly with fetch, with 429/529 backoff.
`TYPESAFE_BASE_URL` can point at a mock for offline testing.

## Deployment
Live at https://doj.blocbrain.xyz — Caddy block in `/etc/caddy/Caddyfile` → `127.0.0.1:3210`,
pm2 app `dungeon-of-jev` (`ecosystem.config.cjs`, logs in `logs/`). After changes: `pm2 restart dungeon-of-jev`.
On the host, pm2 must run under its systemd unit — check the server's own notes before (re)starting pm2.
Public API is guarded: 30 Jev calls/min per IP, 10M input tokens/day (~$0.42) — env `JEV_PER_IP_PER_MINUTE`,
`JEV_DAILY_TOKEN_BUDGET`. Over a limit the client uses the fallback AI. A move call is ~950 input tokens.

## Balance & evaluation
- `scripts/balance-sim.ts` — offline (no API): careful bot vs greedy AI, 5-room runs + matchup table. Run after any number change.
- `scripts/eval-jev.ts` — real Jev on clear-cut scenarios (lethal available, about to die, empowered…), 3× each with shuffled options.
- `scripts/jev-sim.ts [n]` — careful bot vs real Jev, full runs (~$0.01 per run).
- Champion class is *sampled* from Jev's probabilities (Jev rates it ~50/50; argmax always fielded one class). Moves use argmax.
- Model pinned to `jev-1.14.0` (2026-10-15; `jev-latest` still pointed at 1.13.0). Override with `TYPESAFE_MODEL`.
  1.14 passed every eval scenario and plays noticeably harder than 1.13 in `jev-sim`.

## Commands
```bash
bun run dev        # hot-reload server on 127.0.0.1:3210 (stop the pm2 app first, same port)
bun test           # combat rules tests
bun run typecheck
```
