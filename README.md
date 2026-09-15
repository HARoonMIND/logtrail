# LogTrail — XML log analytics dashboard

Next.js 16 (App Router) log analytics console for XML/plain-text application logs, with
SQLite-backed authentication, a configurable log folder path, a searchable log explorer,
a folder/file browser and live tail.

## Stack

| Concern    | Choice |
| ---------- | ------ |
| Framework  | Next.js 16 (App Router, Turbopack) + React 19 + TypeScript |
| UI kit     | [shadcn/ui](https://ui.shadcn.com) (free, MIT) on Tailwind CSS v4 |
| Charts     | Recharts via the shadcn `chart` primitives |
| Icons      | lucide-react |
| Database   | SQLite (`better-sqlite3`), passwords hashed with `bcryptjs` |
| XML parser | `fast-xml-parser` |

## Getting started

```bash
npm install
npm run seed:logs     # optional: generate a sample log tree under ./sample-logs
npm run dev           # http://localhost:3000
```

First run creates `data/logtrail.db` and seeds an admin account:

| Username | Password     |
| -------- | ------------ |
| `admin`  | `Admin@12345` |

Override the seed with `LOGTRAIL_ADMIN_USER`, `LOGTRAIL_ADMIN_EMAIL` and
`LOGTRAIL_ADMIN_PASSWORD` before the first start. Change the password from
**Settings → Change your password** after signing in.

### Environment variables

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `LOGTRAIL_DB_PATH` | `./data/logtrail.db` | SQLite file location |
| `LOGTRAIL_LOG_ROOT` | `C:\MyHolidays\XMLLogs` | Seeded log root (stored in SQLite afterwards) |
| `LOGTRAIL_FALLBACK_ROOT` | `./sample-logs` | Used when the configured root is unreachable |

## Log source

The log root is stored in the SQLite `settings` table and editable at **Settings → Log source**.
The default is `C:\MyHolidays\XMLLogs`; UNC paths (`\\server\share\XMLLogs`) work too. When the
configured path cannot be read (for example when running on Linux), the app falls back to the
bundled sample tree and shows a banner on every page.

### Expected folder structure

```
C:\MyHolidays\XMLLogs\
└── <Application>\            e.g. BookingService
    └── <YYYY>\               2026
        └── <MM>\             09
            └── <DD>\         15
                ├── BookingService_20260915_080000.xml
                ├── BookingService_20260915_130000.xml
                └── BookingService_20260915_190000.xml
```

The date/time in the file name (`<App>_<YYYYMMDD_HHmmss>`) is parsed and shown in the file
browser, and is used as the entry timestamp when an entry itself carries none.

### Supported log formats

XML entries are matched structurally, so most schemas work without configuration — a node counts
as an entry when it carries a timestamp plus a message/level/exception. Attribute and element
styles are both handled, including log4net/log4j events:

```xml
<log application="BookingService">
  <entry timestamp="2026-09-15T08:12:44Z" level="ERROR" logger="Booking.Infra.SqlRepository"
         thread="28" machine="WEB-PRD-01" user="svc_booking">
    <message>SQL timeout while persisting reservation BK-482910</message>
    <exception>System.Data.SqlClient.SqlException: Timeout expired. ...</exception>
  </entry>
</log>
```

Plain-text logs (`.log`, `.txt`) are parsed with a timestamp/level line matcher, and indented
continuation lines are attached to the preceding entry as a stack trace.

Recognised aliases: timestamp/time/date/datetime/logdate, level/severity/priority,
message/msg/text, logger/source/component/class, thread, machine/host/server, user,
exception/stacktrace/error.

## Features

- **Dashboard** — KPI cards (entries, errors, warnings, error rate, files, bytes), stacked log
  volume timeline (24h / 7d / 30d), severity mix donut, busiest loggers, grouped top errors,
  newest files and latest errors.
- **Log explorer** — full-text search across message/logger/stack/machine, level toggles, from/to
  range, per-file filter, sorting, pagination, expandable rows with stack traces, CSV/JSON export.
- **Files & folders** — folder tree with per-folder file counts and sizes, flat file table with
  parsed log datetime, modified time and size, raw file view.
- **Live tail** — polling stream with pause/resume, text filter and adjustable interval.
- **Settings** — log root path, file extensions, scan depth, max files per scan, retention,
  live-tail interval, timezone; all persisted in SQLite.
- **Users & audit** — user list with roles (`admin`/`viewer`), user creation, and an audit trail of
  logins, failed logins, settings changes and exports.

## Security notes

- Passwords are bcrypt hashes (cost 12); the plain text is never stored.
- Sessions are random 256-bit tokens in the `sessions` table, referenced by an httpOnly cookie
  (`secure` in production), expiring after 7 days; changing a password revokes all sessions.
- `src/proxy.ts` performs an optimistic redirect for unauthenticated requests; every page and
  route handler re-verifies the session server-side.
- Raw file reads are constrained to paths inside the configured log root.

## Scripts

| Script | Purpose |
| ------ | ------- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run lint` / `npm run typecheck` | ESLint and TypeScript |
| `npm run seed:logs [root] [days]` | Generate sample XML/text logs |
