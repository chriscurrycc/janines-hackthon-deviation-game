# Deviation Game

Draw so a human gets it but the **AI doesn't**. Solo practice vs. an AI opponent, or
multiplayer rooms where one person draws and everyone else + the AI race to guess.

## Architecture

A pnpm monorepo with a clear split between the stateless web tier and the stateful realtime tier:

| Package | What it is | Port |
| --- | --- | --- |
| `apps/web` | **Next.js** app (App Router). UI + `/api/guess` (solo AI). `output: 'standalone'`. | 7242 |
| `apps/realtime` | **WebSocket** service (`ws`). In-memory rooms, rounds, scoring, AI for multiplayer. | 7243 |
| `packages/shared` | Pure-TS shared code: types, word decks, round picking, and the Claude vision guesser. | — |

> Next.js has no native WebSocket support in route handlers, so realtime is a **separate
> service** rather than a custom server — this keeps the Next app fully idiomatic
> (standalone output, all optimizations) and lets realtime restart/scale independently.

The Claude vision guesser (`@deviation/shared/server`) is shared: the web app calls it from
`/api/guess` (solo) and the realtime service calls it directly (multiplayer).

## Local development

```bash
pnpm install
cp .env.example .env        # add your ANTHROPIC_API_KEY (without it, the AI runs in mock mode)
pnpm dev                    # web on :7242, realtime on :7243 (NEXT_PUBLIC_WS_URL preset)
```

Open http://localhost:7242. For multiplayer, open a second tab, create a room in one and
join with the code in the other.

## Environment

| Var | Default | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | Required for the real AI; missing key → mock guesses (game still playable). |
| `ANTHROPIC_MODEL` | `claude-haiku-4-5` | Vision model. Use `claude-sonnet-4-6` for the stronger tier. |
| `ANTHROPIC_BASE_URL` | `https://api.anthropic.com` | Optional override (proxy/gateway). |
| `NEXT_PUBLIC_WS_URL` | (unset → same-origin `/ws`) | Set in dev to `ws://localhost:7243/ws`; leave unset in prod (nginx routes `/ws`). |

## Deploy (private server, Docker)

```bash
cp .env.example .env        # set ANTHROPIC_API_KEY, ANTHROPIC_MODEL
docker compose up -d --build
```

This brings up `web` (:7242) and `realtime` (:7243). Put them behind nginx using
`nginx.example.conf` — it routes `/ws` to the realtime service with the required
WebSocket upgrade headers and everything else to the web app.
