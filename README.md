# MotoDoc

Car care for drivers and garages: one app in two parts that share an origin, a session, and a database.

- `landing/` — the landing page, authentication, the account area (`/app`), and the Express API (`/api`). Vite + React. See `landing/README.md`.
- `dashboard-next/` — the driver's car dashboard (`/dashboard`). Next.js. See `dashboard-next/README.md`.

## Run it

Install once in each part (`npm install` in `landing` and in `dashboard-next`), then from this folder:

```sh
npm run dev
```

This starts the API (4174), the dashboard (4180), and the landing app (4173). Open `http://localhost:4173`.

`npm test` runs the backend tests and the dashboard typecheck.
