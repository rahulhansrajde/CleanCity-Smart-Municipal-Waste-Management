# CleanCity — Municipal Waste Management (MERN)

Digital tracking of **waste segregation**, **recycling plants**, **landfill utilisation** and **operational efficiency** for a municipal corporation.

- **MongoDB** — accessed through Mongoose; the connection string comes from `MONGO_URI` in `server/.env`. Demo data is seeded on first start.
- **Express + Node** — REST API with JWT auth and role-based access.
- **React (Vite)** — dashboard UI with Recharts, light/dark theme, responsive layout.

## Run it

```bash
cp server/.env.example server/.env   # then set MONGO_URI and JWT_SECRET
npm run install:all     # installs root, server and client deps
npm run dev             # API on :5000 + React dev server on http://localhost:5173
```

Production-style (single port):

```bash
npm run build           # builds client/dist
npm start               # serves API + built UI on http://localhost:5000
```

## Demo accounts

| Role       | Email                    | Password  |
|------------|--------------------------|-----------|
| Admin      | admin@cleancity.gov       | admin123  |
| Supervisor | supervisor@cleancity.gov  | super123  |
| Operator   | operator@cleancity.gov    | oper123   |
| Citizen    | citizen@cleancity.gov     | citizen123 |

Citizens can also create their own account from the login page ("Create an account").

### What each role can see

| Page | Admin | Supervisor | Operator | Citizen |
|---|---|---|---|---|
| Dashboard & alerts | ✓ | ✓ | – | – |
| Live Map | ✓ (+ simulation controls) | ✓ (+ simulation controls) | ✓ | – |
| Citizen Requests | ✓ | ✓ | ✓ | – |
| My Requests | – | – | – | ✓ |
| Segregation | ✓ | ✓ | ✓ (add & edit) | – |
| Wards | ✓ | ✓ | – | – |
| Vehicles | ✓ | ✓ | – | – |
| Recycling Plants | ✓ | ✓ | ✓ (add daily entries) | – |
| Landfills | ✓ | ✓ | ✓ (add waste entries) | – |
| Reports | ✓ | ✓ | – | – |
| Users | ✓ | – | – | – |

### Citizen requests & automatic dispatch

1. A citizen reports a problem (overflowing bin, missed collection, illegal dumping…) and taps the map to mark the place.
2. The server immediately assigns the **nearest free truck** (shortest straight-line distance). If every truck is busy the request waits and is assigned as soon as one frees up.
3. The truck drives to the spot, collects for a few seconds, the request is marked done, and the truck returns to its ward depot.

The movement is a server-side simulation (`server/src/services/simulation.js`, one tick per second, straight-line travel). Admins and supervisors control it from the Live Map: play/pause, speed (1×/2×/5×), random requests on/off, and "add one request now". Map tiles come from OpenStreetMap, so the map needs an internet connection.

Admins can also delete wards, vehicles, plants and landfills. Admins and supervisors can delete records.
Page rules live in `client/src/utils/access.js`; the API enforces the same limits (`/api/analytics` is admin/supervisor only, `/api/users` is admin only, and operators get only name lists from `/api/wards` and `/api/vehicles`).

## Modules

| Page | What it tracks |
|------|----------------|
| Dashboard | KPIs (collected, segregation, recovery, diversion), daily stream trend, composition, ward ranking, landfill & plant meters, alerts |
| Waste Segregation | Ward/shift collection logs split into wet, dry, hazardous, e-waste and mixed; filters, pagination, CSV export |
| Wards & Zones | Per-ward segregation vs target, per-capita generation, household coverage |
| Fleet & Efficiency | Vehicles, load factor, fuel per tonne, km/L, maintenance status |
| Recycling Plants | Capacity utilisation, recovery rate, uptime, energy; daily throughput logs per plant |
| Landfills | Fill level, remaining capacity, daily inflow, projected life; weighbridge inflow register |
| Reports | Custom date range, monthly trends, zone comparison, tabular reports with CSV export and print |
| Users | Admin-only user and role management |

## API overview

All routes except `/api/auth/login` and `/api/health` require `Authorization: Bearer <token>`.

```
POST /api/auth/login              GET  /api/auth/me
GET  /api/analytics/overview?days=30
GET  /api/analytics/report?from=YYYY-MM-DD&to=YYYY-MM-DD
GET|POST /api/collections         GET|PUT|DELETE /api/collections/:id
GET|POST /api/wards               GET|PUT|DELETE /api/wards/:id
GET|POST /api/vehicles            GET|PUT|DELETE /api/vehicles/:id
GET|POST /api/plants              GET|PUT|DELETE /api/plants/:id
GET|POST /api/plants/:id/logs     DELETE /api/plants/logs/:logId
GET|POST /api/landfills           GET|PUT|DELETE /api/landfills/:id
GET|POST /api/landfills/:id/entries   DELETE /api/landfills/entries/:entryId
GET|POST /api/users (admin)       PUT|DELETE /api/users/:id
```

List endpoints accept `?days=` or `?from=&to=` and return records with computed stats for that period.

## Project structure

```
server/src
  index.js            Express app, static client serving, error handling
  db.js               MongoDB connection (Mongoose)
  seed.js             Deterministic 150-day demo dataset
  models/             User, Ward, Vehicle, Collection, RecyclingPlant, PlantLog, Landfill, LandfillEntry
  routes/             REST routes (+ crud.js helper)
  services/stats.js   Aggregations shared by lists and analytics
client/src
  pages/              One file per screen
  components/         Layout, Modal, UI primitives, charts
  context/            Auth, theme (incl. chart palette), confirm dialog
```
