# Frontend Guide

The frontend is a Next.js app at the repository root. It has two local faces:

- `/` for the ORACLE landing/market experience.
- `/console` for the agent run console.

## Run Locally

From the repository root:

```powershell
npm run dev -- -H 0.0.0.0
```

Open:

```text
http://localhost:3000
http://localhost:3000/console
```

## Local Backend Connection

The console expects:

```text
NEXT_PUBLIC_API_URL=http://localhost:8001
NEXT_PUBLIC_WS_URL=ws://localhost:8001
```

These values are read by Next.js from local environment variables.

## Console Workflow

1. Sign in with Supabase email/password.
2. Open `/console`.
3. Click **Polycognitive agent**.
4. Watch the chat-style transcript update with scout messages, tool cards, ledger cards, and a final decision card.
5. Use manual fixture override only when debugging a known SportMonks fixture.
6. Inspect past runs from the sidebar.

## WebSocket Flow

The dashboard opens:

```text
ws://localhost:8001/ws/runs
```

Default auto-scout run:

```json
{"mode":"auto","dry_run":true}
```

Manual fixture override:

```json
{"mode":"manual","fixture_id":19609127,"dry_run":true}
```

The backend then streams:

- selected fixture,
- Sportmonks digest output,
- Polymarket digest output,
- Supabase digest output,
- prediction output,
- strategy output,
- executor result,
- ledger writer result.

## Vercel Deployment

The frontend can deploy to Vercel as a normal root-level Next.js app.

Set Vercel environment variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_WS_URL
```

For a laptop-hosted backend, `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` must use a public tunnel URL, not `localhost`.

Example:

```text
NEXT_PUBLIC_API_URL=https://your-cloudflare-tunnel-url
NEXT_PUBLIC_WS_URL=wss://your-cloudflare-tunnel-url
```

## Design Notes

The console is intentionally operational: it favors dense, inspectable run state over marketing layout. It should help you explain the agent pipeline live:

- what data was fetched,
- what each agent digested,
- what prediction was made,
- why strategy traded or skipped,
- and what would be written to the ledger.
