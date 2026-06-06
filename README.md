# polymarket

World Cup Arena multi-agent backend and Next.js dashboard.

## Backend

Run the Python backend in Docker:

```powershell
docker compose up --build
```

Backend URL:

```text
http://localhost:8001
```

WebSocket URL:

```text
ws://localhost:8001/ws/runs
```

## Frontend

The Next.js frontend lives at the repository root and can be deployed on Vercel. Set:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_WS_URL
```

For local frontend development, use `http://localhost:8001` and `ws://localhost:8001`.

For the deployed Vercel frontend, the browser cannot reach `localhost` on your laptop. Expose the backend with a public HTTPS/WebSocket URL, then set Vercel env vars:

```text
NEXT_PUBLIC_API_URL=https://your-public-backend-url
NEXT_PUBLIC_WS_URL=wss://your-public-backend-url
```

The backend allows this deployed origin by default:

```text
https://polymarket-six-eta.vercel.app
```
