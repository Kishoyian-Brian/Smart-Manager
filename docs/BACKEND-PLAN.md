# Backend Implementation Plan — Smart City Waste Management

This document outlines a step-by-step plan to add a backend to the existing frontend application, replacing localStorage with a real database and API.

---

## 1. Goals

- **Persist data** in a database (reports, users) instead of localStorage
- **Secure authentication** with tokens (e.g. JWT) and password hashing
- **REST API** that mirrors the current `WasteData` operations
- **Minimal frontend changes** — swap the data layer to call the API instead of localStorage
- **Deployable** — backend can run locally or on a server

---

## 2. Technology Choices

### Option A — Node.js + Express

| Layer        | Choice              | Why |
|-------------|---------------------|-----|
| Runtime     | Node.js (LTS)       | Matches your JS frontend; easy to share types/logic |
| Framework   | Express.js          | Simple, widely used, lots of middleware |
| Database    | SQLite (dev) / PostgreSQL (prod) | SQLite for quick start; Postgres for production |
| ORM         | Prisma or Drizzle   | Type-safe schema, migrations, easy queries |
| Auth        | JWT + bcrypt        | Stateless, works well with SPA; bcrypt for passwords |
| Validation  | Zod or express-validator | Validate request bodies and query params |

### Option A2 — Node.js + NestJS

| Layer        | Choice              | Why |
|-------------|---------------------|-----|
| Runtime     | Node.js (LTS)       | Same as frontend; TypeScript-first |
| Framework   | NestJS              | Structured: modules, DI, decorators; built-in guards, pipes, JWT |
| Language    | TypeScript          | Strong typing, same API design as Express but with decorators |
| Database    | PostgreSQL          | TypeORM or Prisma integrate well; migrations included |
| ORM         | TypeORM or Prisma   | TypeORM: decorators on entities; Prisma: same as Express option |
| Auth        | `@nestjs/jwt` + `@nestjs/passport` (JWT + bcrypt) | Built-in auth module, guards for roles |
| Validation  | `class-validator` + `class-transformer` | ValidationPipe + DTOs with decorators |

- **NestJS** gives you a clear module layout (e.g. `AuthModule`, `ReportsModule`, `UsersModule`), dependency injection, and built-in support for guards (e.g. `@UseGuards(JwtAuthGuard, RolesGuard)`) and role-based access (`@Roles('admin')`). Good fit if you want more structure and TypeScript.

### Option B — PHP + PostgreSQL

| Layer        | Choice              | Why |
|-------------|---------------------|-----|
| Runtime     | PHP 8.1+            | Widely supported on shared hosting; native sessions optional |
| Framework   | Slim 4 or vanilla PHP | Slim: lightweight REST API; vanilla: minimal dependencies |
| Database    | PostgreSQL          | Robust, good for production; same schema as below |
| Access      | PDO                 | Built-in, secure prepared statements; no ORM required |
| Auth        | JWT (firebase/php-jwt) + `password_hash()` | `password_hash(PASSWORD_BCRYPT)` for passwords; JWT for API |
| Validation  | Filter input + simple checks | `filter_var`, `isset`, or a small validation helper |

- **Yes, it’s possible.** PHP + PostgreSQL is a common and solid choice for this kind of API.

### Option C — Python

| Layer        | Choice              |
|-------------|---------------------|
| Runtime     | Python 3.11+        |
| Framework   | FastAPI or Flask    |
| Database    | SQLite / PostgreSQL |
| ORM         | SQLAlchemy or Django ORM |
| Auth        | JWT (PyJWT) + passlib (bcrypt) |

**Recommendation:** Option A (Express) for a minimal Node setup; Option A2 (NestJS) if you want structure and TypeScript; Option B (PHP + PostgreSQL) if you prefer PHP and Postgres (e.g. hosting or team skills).

---

## 3. Database Schema

Map your current data model to tables. Use **PostgreSQL** syntax below; for SQLite (Node dev), use `INTEGER PRIMARY KEY AUTOINCREMENT` and `DATETIME` as in the note at the end.

### 3.1 Users (PostgreSQL)

```sql
-- users (PostgreSQL)
CREATE TABLE users (
  id             SERIAL PRIMARY KEY,
  username       VARCHAR(255) UNIQUE NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  role           VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'collector')),
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_username ON users(username);
```

- **Never store plain passwords.** Store `password_hash` (bcrypt).
- For SQLite: use `INTEGER PRIMARY KEY AUTOINCREMENT` and `DATETIME DEFAULT CURRENT_TIMESTAMP`.

### 3.2 Reports (PostgreSQL)

```sql
-- reports (PostgreSQL)
CREATE TABLE reports (
  id            VARCHAR(50) PRIMARY KEY,
  name          VARCHAR(255),
  location      VARCHAR(500) NOT NULL,
  waste_type    VARCHAR(100),
  fill_level    VARCHAR(50),
  status        VARCHAR(50) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'collected')),
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  approved_at   TIMESTAMP WITH TIME ZONE,
  collected_at  TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_created_at ON reports(created_at);
```

- For SQLite: use `REAL` for lat/lng and `DATETIME` for timestamps.

### 3.3 Sessions (optional, DB-backed)

If you use **database sessions** instead of JWT (e.g. PHP sessions in DB):

```sql
-- sessions (optional, PostgreSQL)
CREATE TABLE sessions (
  id            VARCHAR(255) PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  expires_at    TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

For a **JWT-based** backend you don’t need this table; the token carries user identity and expiry.

---

## 4. API Design

Design endpoints to mirror `WasteData` so the frontend can switch with minimal changes.

### 4.1 Base URL

- **Node:** Development `http://localhost:3000/api` (or another port).
- **PHP:** Development `http://localhost:8000/api` (e.g. `php -S localhost:8000 -t public`) or your Apache/Nginx vhost.
- Frontend will call e.g. `fetch(API_BASE + '/reports')` where `API_BASE` is set to the backend URL.

### 4.2 Authentication

| Method | Endpoint           | Body / Headers        | Description |
|--------|--------------------|------------------------|-------------|
| POST   | `/auth/login`      | `{ username, password }` | Login; returns `{ user, token }` |
| POST   | `/auth/logout`     | (optional)             | Invalidate session/token (if needed) |
| GET    | `/auth/me`         | `Authorization: Bearer <token>` | Return current user |

- **Login response:** e.g. `{ user: { username, role }, token: "jwt..." }`
- Frontend stores `token` (e.g. in memory or localStorage/sessionStorage) and sends it in `Authorization: Bearer <token>` for protected routes.

### 4.3 Reports (Public — submit only)

| Method | Endpoint        | Body | Description |
|--------|-----------------|------|-------------|
| POST   | `/reports`      | `{ name, location, wasteType, fillLevel, lat?, lng? }` | Create report (status: pending) |

- No auth required (citizens can submit without logging in).
- Server sets: `id`, `status: 'pending'`, `createdAt`, `approvedAt: null`, `collectedAt: null`.

### 4.4 Reports (Protected — admin/collector)

| Method | Endpoint              | Auth   | Description |
|--------|------------------------|--------|-------------|
| GET    | `/reports`             | Admin or Collector | List all reports (optional query: `?status=pending`) |
| GET    | `/reports/pending`     | Admin | List pending only |
| GET    | `/reports/approved`    | Admin or Collector | List approved only |
| GET    | `/reports/collected`   | Admin | List collected only |
| GET    | `/reports/:id`         | Admin or Collector | Get one report |
| PATCH  | `/reports/:id/approve`  | Admin | Set status to approved |
| PATCH  | `/reports/:id/reject`  | Admin | Delete or mark rejected |
| PATCH  | `/reports/:id/collect`  | Admin or Collector | Set status to collected |

Use **role checks** in the backend: e.g. only admin can approve/reject; collector can only collect approved reports.

### 4.5 Analytics / Heat Map

| Method | Endpoint                    | Auth | Description |
|--------|-----------------------------|------|-------------|
| GET    | `/reports/analytics/locations` | Admin | Aggregated collection counts by location (for heat map) |

- Response shape can match current `getCollectionLocations()`: e.g. `[{ location, count }, ...]` sorted by count descending.

### 4.6 Users (Admin only)

| Method | Endpoint           | Auth | Description |
|--------|--------------------|------|-------------|
| GET    | `/users/collectors`| Admin | List collectors `[{ username }, ...]` |
| POST   | `/users`           | Admin | Register user `{ username, password, role }` |
| DELETE | `/users/:username` | Admin | Remove user (e.g. collector) |

- Passwords hashed with bcrypt before storing.

### 4.7 Optional: Collection Drives

If you keep “Add New Drive” in the UI, add later:

- `POST /drives` — create drive (admin)
- `GET /drives` — list drives

You can defer this to a later phase.

---

## 5. Authentication & Authorization

### 5.1 JWT Flow

1. User logs in with `POST /auth/login` → server checks password (bcrypt), returns JWT.
2. JWT payload example: `{ sub: userId, username, role, iat, exp }`.
3. Frontend stores token; sends `Authorization: Bearer <token>` on every request.
4. Backend middleware: verify JWT, attach `req.user = { id, username, role }`.
5. Route handlers check `req.user.role` (e.g. admin-only, collector-only).

### 5.2 Role Rules

- **Public:** POST `/reports` only.
- **Admin:** All report and user endpoints.
- **Collector:** GET reports, PATCH `/reports/:id/collect`; no approve/reject, no user management.

---

## 6. Implementation Phases

Follow these in order so you always have a working state.

### Phase 1 — Project setup and database

**Node.js + Express:**
1. Create a new folder, e.g. `backend/`, in the repo.
2. Initialize Node: `npm init -y`.
3. Install: `express`, `cors`, `dotenv`, `bcrypt`, `jsonwebtoken`, and an ORM (e.g. `prisma` + `@prisma/client` or `drizzle-orm`).
4. Add scripts in `package.json`: `"start": "node src/index.js"`, `"dev": "nodemon src/index.js"`.
5. Define the schema (Prisma schema or Drizzle) for `users` and `reports`.
6. Run migrations; seed an admin and a collector user (with hashed passwords).
7. Connect the app to the DB and confirm you can read/write (e.g. simple GET/POST in code).

**Node.js + NestJS:**
1. Create the app: `npx @nestjs/cli new backend` (choose npm/yarn, no strict mode optional).
2. Add packages: `@nestjs/typeorm`, `typeorm`, `pg`, `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `bcrypt`, `class-validator`, `class-transformer`. Or use Prisma: `prisma`, `@prisma/client` and optionally `nestjs-prisma`.
3. Configure TypeORM (or Prisma) in `AppModule` with PostgreSQL (e.g. in `app.module.ts` and `.env`: `DATABASE_URL`).
4. Generate modules: `nest g module auth`, `nest g module reports`, `nest g module users`; generate entities (e.g. `User`, `Report`) and DTOs.
5. Run migrations (TypeORM: `synchronize: true` in dev or run migration; Prisma: `prisma migrate dev`).
6. Seed users (e.g. a `seed.ts` script or a dedicated endpoint in dev): hash passwords with bcrypt, insert admin and collector.
7. Confirm the app runs (`npm run start:dev`) and DB connection works (e.g. simple GET in a controller).

**PHP + PostgreSQL:**
1. Create a new folder, e.g. `backend/` or `api/`, in the repo.
2. Ensure PHP 8.1+ and PostgreSQL are installed; enable PDO PostgreSQL (`pdo_pgsql`) in PHP.
3. Install Composer; create `composer.json` and require e.g. `slim/slim`, `tuupola/slim-jwt-auth`, `firebase/php-jwt` (or use Slim’s JWT middleware).
4. Create the SQL schema (section 3) and run it in PostgreSQL (e.g. `psql` or pgAdmin).
5. Add a `config.php` or `.env` for `DATABASE_URL` (e.g. `pgsql:host=localhost;dbname=waste_db`) and `JWT_SECRET`.
6. Create a PDO connection helper; seed `users` with `password_hash('admin123', PASSWORD_BCRYPT)` (and same for collector).
7. Confirm you can run a simple script that connects and reads/writes (e.g. list users).

**Deliverable:** Backend runs, DB has tables and seed users.

---

### Phase 2 — Auth API

1. Implement `POST /auth/login` (find user by username, compare password with bcrypt / `password_verify()`, issue JWT).
2. Implement `GET /auth/me` (middleware/guard that verifies JWT and returns current user).
3. Add middleware or guards: `authenticate` (optional auth), `requireAuth` (must be logged in), `requireRole('admin')` / `requireRole('collector')`. **NestJS:** use `JwtAuthGuard` and a `RolesGuard` with `@Roles('admin')` / `@Roles('collector')` on controllers or methods.
4. Enable CORS for your frontend origin (e.g. `http://localhost:5500` or wherever you serve the HTML). In PHP, send `Access-Control-Allow-Origin` and handle preflight `OPTIONS` if needed. In NestJS, enable CORS in `main.ts`.

**Deliverable:** You can login and get `user` + `token`; `GET /auth/me` works with the token.

---

### Phase 3 — Reports API (no auth)

1. Implement `POST /reports` (create report, status pending, generate id like `r` + timestamp).
2. Validate body (name, location, wasteType, fillLevel; lat/lng optional).
3. Return created report and id.

**Deliverable:** Frontend (or Postman) can submit a report without logging in.

---

### Phase 4 — Reports API (protected)

1. Implement:
   - `GET /reports` (with optional `?status=pending|approved|collected`), protected.
   - `GET /reports/:id`, protected.
   - `PATCH /reports/:id/approve` (admin), `PATCH /reports/:id/reject` (admin), `PATCH /reports/:id/collect` (admin or collector).
2. Enforce roles in each handler.
3. Add `GET /reports/analytics/locations` for heat map data (admin).

**Deliverable:** All report operations that the admin and collector UIs need are available and secured by role.

---

### Phase 5 — Users API (admin)

1. Implement `GET /users/collectors` (admin only).
2. Implement `POST /users` (admin only; hash password, role = admin or collector).
3. Implement `DELETE /users/:username` (admin only).

**Deliverable:** Admin can manage collectors via API.

---

### Phase 6 — Connect frontend to API

1. Add a config in the frontend for the API base URL (e.g. `window.API_BASE = 'http://localhost:3000/api'` or from env).
2. Create a new `js/api.js` (or refactor `data.js`) that:
   - Uses `fetch` to call the backend instead of localStorage.
   - Sends `Authorization: Bearer <token>` when the user is logged in (read token from sessionStorage or where you currently keep session).
   - Exposes the same interface as current `WasteData` (getAll, getPending, addReport, approve, reject, markCollected, authenticate, registerUser, getCollectors, getCollectionLocations, etc.).
3. On login page: on successful login, store `token` and `user` (e.g. in sessionStorage), then redirect as now.
4. For every request that needs auth, attach the token; on 401, clear session and redirect to login.
5. Replace `WasteData` usage with the new API-backed layer (or make `WasteData` call the API when backend is configured).
6. Remove or disable the old localStorage-based implementation when the backend is in use.

**Deliverable:** Full app works against the backend; no localStorage for reports/users.

---

### Phase 7 — Polish and deploy

1. Environment variables: `PORT` (Node) or docroot (PHP), `DATABASE_URL`, `JWT_SECRET`.
2. Use `JWT_SECRET` with enough entropy; never commit it.
3. Optional: rate limiting, request logging, security headers (e.g. helmet for Node).
4. Deploy backend:
   - **Node:** Railway, Render, Fly.io, or a VPS; use PostgreSQL.
   - **PHP:** Shared hosting with PHP 8.1+ and PostgreSQL, or a VPS with Apache/Nginx + PHP-FPM + PostgreSQL.
5. Deploy frontend (static hosting) and set `API_BASE` to your backend URL.
6. Configure CORS to allow the production frontend origin only (or allow both dev and prod during transition).

**Deliverable:** App running in production with backend + frontend.

---

## 7. Folder Structure (Backend)

**Node.js + Express example:**

```
WasteManagement/
  backend/
    .env
    .env.example
    package.json
    prisma/
      schema.prisma
      migrations/
    src/
      index.js          # Express app, CORS, mount routes
      config.js         # Load env (PORT, DATABASE_URL, JWT_SECRET)
      middleware/
        auth.js         # JWT verify, requireAuth, requireRole
        validate.js     # Validation middleware
      routes/
        auth.js         # POST /login, GET /me
        reports.js      # CRUD + approve/reject/collect, analytics
        users.js        # collectors, create, delete
      db/
        (or use Prisma client directly)
```

**Node.js + NestJS example:**

```
WasteManagement/
  backend/
    .env
    .env.example
    package.json
    src/
      app.module.ts
      main.ts
      auth/
        auth.module.ts
        auth.controller.ts    # POST /auth/login, GET /auth/me
        auth.service.ts
        jwt.strategy.ts
        guards/
          jwt-auth.guard.ts
          roles.guard.ts
        dto/
          login.dto.ts
      reports/
        reports.module.ts
        reports.controller.ts # GET/POST /reports, PATCH /reports/:id/approve, etc.
        reports.service.ts
        entities/
          report.entity.ts
        dto/
          create-report.dto.ts
      users/
        users.module.ts
        users.controller.ts   # GET /users/collectors, POST /users, DELETE /users/:username
        users.service.ts
        entities/
          user.entity.ts
        dto/
          create-user.dto.ts
    prisma/                    # if using Prisma instead of TypeORM
      schema.prisma
      migrations/
```

**PHP + PostgreSQL example:**

```
WasteManagement/
  backend/   (or api/)
    .env
    .env.example
    composer.json
    public/
      index.php        # Front controller: CORS, router, dispatch to handlers
    sql/
      schema.sql       # CREATE TABLE users, reports (PostgreSQL)
      seed.sql         # INSERT default admin + collector
    src/
      config.php       # Load .env, DATABASE_URL, JWT_SECRET
      db.php           # PDO connection
      middleware/
        cors.php       # CORS headers + OPTIONS
        auth.php       # JWT verify, requireAuth, requireRole
      routes/
        auth.php       # POST /auth/login, GET /auth/me
        reports.php    # Reports CRUD + approve/reject/collect, analytics
        users.php      # GET /users/collectors, POST /users, DELETE /users/:username
```

---

## 8. Quick Reference — Current vs Backend

| Current (localStorage)     | Backend equivalent |
|---------------------------|--------------------|
| `WasteData.getAll()`      | `GET /reports`     |
| `WasteData.getPending()`  | `GET /reports?status=pending` or `GET /reports/pending` |
| `WasteData.getApproved()` | `GET /reports/approved` |
| `WasteData.getCollected()`| `GET /reports/collected` |
| `WasteData.getReport(id)` | `GET /reports/:id`  |
| `WasteData.addReport(r)`  | `POST /reports`    |
| `WasteData.approve(id)`   | `PATCH /reports/:id/approve` |
| `WasteData.reject(id)`    | `PATCH /reports/:id/reject`  |
| `WasteData.markCollected(id)` | `PATCH /reports/:id/collect` |
| `WasteData.authenticate(u,p)` | `POST /auth/login` → store token |
| `WasteData.registerUser(...)` | `POST /users` (admin) |
| `WasteData.getCollectors()`   | `GET /users/collectors` (admin) |
| `WasteData.getCollectionLocations()` | `GET /reports/analytics/locations` |
| Session (sessionStorage)     | JWT in header + optional sessionStorage for token |

---

## 9. Next Step

Start with **Phase 1**: create `backend/` (or `api/` for PHP), set up your stack (Node + Express + Prisma **or** PHP + PostgreSQL), define `users` and `reports` tables, run migrations/schema, and seed data. Once that’s done, move to Phase 2 (auth) and then Phase 3–6 to implement and connect the rest.

- **Node + Express:** Use the Express folder structure and Prisma/Drizzle; base URL e.g. `http://localhost:3000/api`.
- **Node + NestJS:** Use the NestJS folder structure; run `npm run start:dev`; base URL e.g. `http://localhost:3000/api` (NestJS uses a global prefix like `/api` if you set it in `main.ts`).
- **PHP + PostgreSQL:** Use the PHP folder structure; serve via PHP built-in server (`php -S localhost:8000 -t public`) or Apache/Nginx; base URL e.g. `http://localhost:8000/api`.

If you tell me your preferred stack (Express, NestJS, or PHP + PostgreSQL), I can generate the exact project skeleton and code for Phase 1 and 2 next.
