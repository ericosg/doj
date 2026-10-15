// Serves the game and makes Jev calls on the browser's behalf, so the API key never leaves the server.
import index from "./index.html";
import { jevAvailable, pickBossForm, pickClass, pickMove } from "./src/server/jev";
import { CLASSES, MOVES, ROOMS, type ClassId, type Fighter, type MoveId } from "./src/shared/rules";

const isClass = (x: unknown): x is ClassId => typeof x === "string" && x in CLASSES;
const isMove = (x: unknown): x is MoveId => typeof x === "string" && x in MOVES;
const int = (x: unknown, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number(x) || 0)));

class BadInput extends Error {}

/** Rebuilds a fighter from untrusted JSON, keeping only known fields within sane bounds. */
function fighter(x: any): Fighter {
  if (!x || !isClass(x.cls)) throw new BadInput("bad fighter");
  const maxHp = int(x.maxHp, 1, 999);
  const maxMp = int(x.maxMp, 0, 999);
  return {
    cls: x.cls,
    name: String(x.name ?? "").slice(0, 40),
    hp: int(x.hp, 0, maxHp),
    maxHp,
    mp: int(x.mp, 0, maxMp),
    maxMp,
    block: int(x.block, 0, 999),
    burn: x.burn ? { perTurn: int(x.burn.perTurn, 0, 99), turns: int(x.burn.turns, 0, 9), kind: x.burn.kind === "bleed" ? "bleed" : "burn" } : null,
    empowered: Boolean(x.empowered),
    weakened: Boolean(x.weakened),
    bonusDamage: int(x.bonusDamage, 0, 99),
    shiftCooldown: int(x.shiftCooldown, 0, 9),
  };
}
const moves = (xs: unknown): MoveId[] => (Array.isArray(xs) ? xs.filter(isMove).slice(-5) : []);

// The game is public and every Jev call spends API credit, so cap calls per IP and tokens per day.
// A normal game makes ~5 calls a minute at ~1k input tokens each. Over a limit, the client
// falls back to its local AI and says so.
const PER_IP_PER_MINUTE = Number(process.env.JEV_PER_IP_PER_MINUTE ?? 30);
const DAILY_TOKEN_BUDGET = Number(process.env.JEV_DAILY_TOKEN_BUDGET ?? 10_000_000); // ~$0.42/day at $0.042/Mtok
const hits = new Map<string, number[]>();
let budgetDay = "";
let tokensToday = 0;

function overLimit(ip: string): string | null {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== budgetDay) {
    budgetDay = today;
    tokensToday = 0;
  }
  if (tokensToday >= DAILY_TOKEN_BUDGET) return "Daily Jev budget used up";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= PER_IP_PER_MINUTE) return "Too many requests, slow down";
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 10_000) hits.clear();
  return null;
}

function clientIp(req: Request): string {
  // Behind Caddy on loopback, the real client is in X-Forwarded-For.
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || server.requestIP(req)?.address || "unknown";
}

async function handle(req: Request, fn: () => Promise<{ inputTokens?: number }>): Promise<Response> {
  if (!jevAvailable()) return Response.json({ error: "TYPESAFE_API_KEY is not set on the server" }, { status: 503 });
  const limited = overLimit(clientIp(req));
  if (limited) return Response.json({ error: limited }, { status: 429 });
  try {
    const result = await fn();
    tokensToday += result.inputTokens ?? 0;
    return Response.json(result);
  } catch (err) {
    if (err instanceof BadInput) return Response.json({ error: err.message }, { status: 400 });
    console.error("[jev] request failed:", err);
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3210),
  hostname: process.env.HOST ?? "127.0.0.1",
  development: process.env.NODE_ENV !== "production",
  routes: {
    "/": index,
    "/favicon.ico": () => new Response(null, { status: 204 }),
    "/api/health": () => Response.json({ jev: jevAvailable() && tokensToday < DAILY_TOKEN_BUDGET }),
    "/api/enemy/class": {
      POST: async (req) => {
        const body: any = await req.json().catch(() => ({}));
        return handle(req, () =>
          pickClass({ room: int(body.room, 0, ROOMS.length - 1), player: fighter(body.player), playerFavoriteMoves: moves(body.playerFavoriteMoves) }),
        );
      },
    },
    "/api/enemy/form": {
      POST: async (req) => {
        const body: any = await req.json().catch(() => ({}));
        return handle(req, () => pickBossForm({ player: fighter(body.player), playerFavoriteMoves: moves(body.playerFavoriteMoves) }));
      },
    },
    "/api/enemy/move": {
      POST: async (req) => {
        const body: any = await req.json().catch(() => ({}));
        return handle(req, () =>
          pickMove({ enemy: fighter(body.enemy), player: fighter(body.player), turn: int(body.turn, 1, 999), playerRecentMoves: moves(body.playerRecentMoves) }),
        );
      },
    },
  },
});

console.log(`Dungeon of Jev running at ${server.url} (Jev ${jevAvailable() ? "enabled" : "DISABLED: set TYPESAFE_API_KEY in .env"})`);
