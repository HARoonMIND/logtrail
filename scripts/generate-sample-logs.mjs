/**
 * Generates a sample log tree that mirrors the expected production layout:
 *
 *   <root>/<Application>/<YYYY>/<MM>/<DD>/<Application>_<YYYYMMDD_HHmmss>.xml
 *
 * Usage: node scripts/generate-sample-logs.mjs [targetRoot] [days]
 */
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2] ?? path.join(process.cwd(), "sample-logs");
const days = Number(process.argv[3] ?? 5);

const apps = ["BookingService", "PaymentGateway", "HolidaySearch", "NotificationWorker"];
const loggers = {
  BookingService: ["Booking.Api.ReservationController", "Booking.Domain.PriceEngine", "Booking.Infra.SqlRepository"],
  PaymentGateway: ["Payments.Api.ChargeController", "Payments.Providers.Stripe", "Payments.Infra.Retry"],
  HolidaySearch: ["Search.Api.QueryController", "Search.Index.Lucene", "Search.Cache.Redis"],
  NotificationWorker: ["Notify.Worker.EmailDispatcher", "Notify.Worker.SmsDispatcher", "Notify.Infra.Queue"],
};
const machines = ["WEB-PRD-01", "WEB-PRD-02", "WRK-PRD-01"];
const users = ["svc_booking", "svc_payments", "haroon", "system"];

const messages = {
  INFO: [
    "Reservation {id} confirmed for 2 travellers",
    "Search completed in {ms} ms returning {n} offers",
    "Payment intent {id} authorised",
    "Email notification queued for booking {id}",
    "Cache warm-up finished for region EU-WEST",
  ],
  WARN: [
    "Upstream provider responded in {ms} ms (slow)",
    "Retry 2/3 for booking {id}",
    "Cache miss rate above 40% for HolidaySearch",
    "Payload larger than 512 KB for request {id}",
  ],
  ERROR: [
    "Payment declined for booking {id}: insufficient funds",
    "SQL timeout while persisting reservation {id}",
    "Provider returned HTTP 502 for availability request {id}",
    "Unhandled exception while rendering itinerary {id}",
  ],
  FATAL: ["Connection pool exhausted - service entering degraded mode"],
  DEBUG: [
    "Resolved tenant configuration for MyHolidays",
    "Serialized request body for {id}",
    "Evaluating price rule set v{n}",
  ],
};

const weights = [
  ["INFO", 58],
  ["DEBUG", 18],
  ["WARN", 14],
  ["ERROR", 9],
  ["FATAL", 1],
];

function pickLevel() {
  const roll = Math.random() * 100;
  let acc = 0;
  for (const [level, weight] of weights) {
    acc += weight;
    if (roll <= acc) return level;
  }
  return "INFO";
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const pad = (n) => String(n).padStart(2, "0");

function escapeXml(value) {
  return value.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c],
  );
}

function stackTrace(app) {
  return [
    "System.Data.SqlClient.SqlException: Timeout expired.",
    `   at ${app}.Infrastructure.SqlRepository.SaveAsync(Reservation reservation)`,
    `   at ${app}.Domain.BookingService.ConfirmAsync(Guid id)`,
    `   at ${app}.Api.ReservationController.Post(ReservationRequest request)`,
  ].join("\n");
}

function buildFile(app, date, hour) {
  const entries = [];
  const count = 25 + Math.floor(Math.random() * 45);

  for (let i = 0; i < count; i += 1) {
    const level = pickLevel();
    const at = new Date(date);
    at.setHours(hour, Math.floor(Math.random() * 60), Math.floor(Math.random() * 60), 0);

    const template = pick(messages[level]);
    const message = template
      .replace("{id}", `BK-${100000 + Math.floor(Math.random() * 899999)}`)
      .replace("{ms}", String(20 + Math.floor(Math.random() * 3000)))
      .replace("{n}", String(1 + Math.floor(Math.random() * 40)));

    const exception =
      level === "ERROR" || level === "FATAL"
        ? `\n    <exception>${escapeXml(stackTrace(app))}</exception>`
        : "";

    entries.push(
      `  <entry timestamp="${at.toISOString()}" level="${level}" ` +
        `logger="${pick(loggers[app])}" thread="${10 + Math.floor(Math.random() * 40)}" ` +
        `machine="${pick(machines)}" user="${pick(users)}">\n` +
        `    <message>${escapeXml(message)}</message>${exception}\n` +
        `  </entry>`,
    );
  }

  return `<?xml version="1.0" encoding="utf-8"?>\n<log application="${app}">\n${entries.join("\n")}\n</log>\n`;
}

fs.rmSync(root, { recursive: true, force: true });

let fileCount = 0;
const today = new Date();

for (const app of apps) {
  for (let d = 0; d < days; d += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - d);

    const dir = path.join(
      root,
      app,
      String(date.getFullYear()),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
    );
    fs.mkdirSync(dir, { recursive: true });

    for (const hour of [8, 13, 19]) {
      const stamp =
        `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
        `_${pad(hour)}0000`;
      fs.writeFileSync(path.join(dir, `${app}_${stamp}.xml`), buildFile(app, date, hour));
      fileCount += 1;
    }
  }
}

// One plain-text log to exercise the non-XML parser.
const textDir = path.join(root, "IISWeb", String(today.getFullYear()), pad(today.getMonth() + 1), pad(today.getDate()));
fs.mkdirSync(textDir, { recursive: true });
const textLines = [];
for (let i = 0; i < 120; i += 1) {
  const at = new Date(today.getTime() - i * 60_000);
  const level = pickLevel();
  textLines.push(
    `${at.toISOString().replace("T", " ").slice(0, 23)} [${level}] IISWeb.RequestPipeline - ` +
      `GET /api/holidays/search took ${20 + Math.floor(Math.random() * 900)} ms`,
  );
}
fs.writeFileSync(
  path.join(textDir, `IISWeb_${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}_000000.log`),
  `${textLines.reverse().join("\n")}\n`,
);
fileCount += 1;

console.log(`Generated ${fileCount} log files under ${root}`);
