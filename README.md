# Friends — admin dashboard

Web admin panel for the self-hosted Friends random video chat backend.
Plain HTML + ES modules, no build step and no third-party scripts.

**Pages:** Overview (online now, signups, calls, platform split, online history chart),
Users (search, ban/unban, grant premium, roles), Calls, Reports (review → ban / dismiss),
Countries, Settings (matching rules, plans, admin accounts).

## How it runs

The backend serves this folder at `https://<API_DOMAIN>/dashboard/` (same origin as the API,
so no CORS), with a strict Content-Security-Policy. It must sit at `dashboard/` in the backend
repo; the backend's Dockerfile copies it into the image.

Sign in with an admin created on the server:

```bash
docker compose exec api python -m app.cli create-admin you@example.com '<strong password>' superadmin
```

Roles: `superadmin` (everything, including managing admins), `admin` (everything else),
`moderator` (users, bans and reports), `analyst` (read-only stats).

## Develop

Run the backend locally (`uvicorn app.main:app --port 8000`) and open
http://127.0.0.1:8000/dashboard/. Edit files and reload; there is nothing to compile.

```
index.html, styles.css
js/app.js        router, sign-in, layout
js/lib.js        API client, DOM helpers
js/charts.js     SVG charts
js/pages/*.js    one module per page
```

Because of the CSP, don't use inline `<script>`, inline event handlers or `style="..."`
attributes; set styles with `el.style.cssText` or CSS classes.
