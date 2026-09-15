/**
 * Generates a sample log tree that mirrors the expected production layout:
 *
 *   <root>/ErrorLog/<yyyy-MM-dd>/ErrorLog_<yyyyMMdd_HHmmss>.xml
 *   <root>/Hotel/HotelBook|HotelSearch|PortalSearch/<yyyy-MM-dd>/...
 *   <root>/SupplierLog/<Supplier>/<yyyy-MM-dd>/...
 *
 * A new dated folder is created per day; each file holds XML entries that carry a
 * request URL and JSON request/response payloads.
 *
 * Usage: node scripts/generate-sample-logs.mjs [targetRoot] [days]
 */
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2] ?? path.join(process.cwd(), "sample-logs");
const days = Number(process.argv[3] ?? 5);

/** section -> categories (empty string means the section itself holds the date folders). */
const LAYOUT = {
  ErrorLog: [""],
  Hotel: ["HotelBook", "HotelSearch", "PortalSearch"],
  SupplierLog: ["Expedia", "Hotelbeds", "Booking"],
};

const LOGGERS = {
  ErrorLog: ["Portal.Web.GlobalErrorHandler", "Portal.Api.ExceptionFilter", "Portal.Infra.Sql"],
  HotelBook: ["Hotel.Book.BookingController", "Hotel.Book.PriceCheck", "Hotel.Book.Confirmation"],
  HotelSearch: ["Hotel.Search.QueryBuilder", "Hotel.Search.Availability", "Hotel.Search.Cache"],
  PortalSearch: ["Portal.Search.Aggregator", "Portal.Search.Ranking", "Portal.Search.Filters"],
  Expedia: ["Supplier.Expedia.Client", "Supplier.Expedia.Mapper"],
  Hotelbeds: ["Supplier.Hotelbeds.Client", "Supplier.Hotelbeds.Mapper"],
  Booking: ["Supplier.Booking.Client", "Supplier.Booking.Mapper"],
};

const ENDPOINTS = {
  ErrorLog: "https://portal.myholidays.com/api/diagnostics/error",
  HotelBook: "https://api.myholidays.com/v2/hotel/book",
  HotelSearch: "https://api.myholidays.com/v2/hotel/search",
  PortalSearch: "https://portal.myholidays.com/api/search",
  Expedia: "https://api.expedia.com/v3/properties/availability",
  Hotelbeds: "https://api.hotelbeds.com/hotel-api/1.0/hotels",
  Booking: "https://distribution-xml.booking.com/json/bookings",
};

const MACHINES = ["WEB-PRD-01", "WEB-PRD-02", "WRK-PRD-01"];
const USERS = ["svc_booking", "svc_search", "haroon", "system"];
const CITIES = ["Dubai", "London", "Istanbul", "Male", "Bangkok"];

const MESSAGES = {
  INFO: [
    "Search completed in {ms} ms returning {n} offers",
    "Booking {id} confirmed for 2 travellers",
    "Supplier response mapped for {id}",
    "Rate plan revalidated for {id}",
  ],
  WARN: [
    "Supplier responded in {ms} ms (slow)",
    "Retry 2/3 for request {id}",
    "Price changed during booking {id}",
    "Availability cache miss for {city}",
  ],
  ERROR: [
    "Supplier returned HTTP 502 for availability request {id}",
    "SQL timeout while persisting booking {id}",
    "Payment declined for booking {id}: insufficient funds",
    "Invalid supplier response schema for {id}",
  ],
  FATAL: ["Connection pool exhausted - service entering degraded mode"],
  DEBUG: ["Resolved tenant configuration for MyHolidays", "Evaluating markup rule set v{n}"],
};

const WEIGHTS = [
  ["INFO", 58],
  ["DEBUG", 16],
  ["WARN", 14],
  ["ERROR", 11],
  ["FATAL", 1],
];

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const pad = (n) => String(n).padStart(2, "0");
const rand = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

function pickLevel(errorHeavy) {
  if (errorHeavy) return Math.random() < 0.85 ? "ERROR" : "FATAL";
  const roll = Math.random() * 100;
  let acc = 0;
  for (const [level, weight] of WEIGHTS) {
    acc += weight;
    if (roll <= acc) return level;
  }
  return "INFO";
}

function escapeXml(value) {
  return value.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c],
  );
}

function stackTrace(area) {
  return [
    "System.Data.SqlClient.SqlException: Timeout expired.",
    `   at MyHolidays.${area}.Infrastructure.SqlRepository.SaveAsync(Booking booking)`,
    `   at MyHolidays.${area}.Domain.BookingService.ConfirmAsync(Guid id)`,
    `   at MyHolidays.${area}.Api.BookingController.Post(BookingRequest request)`,
  ].join("\n");
}

function buildFile(area, date, hour, errorHeavy) {
  const entries = [];
  const count = rand(18, 40);

  for (let i = 0; i < count; i += 1) {
    const level = pickLevel(errorHeavy);
    const at = new Date(date);
    at.setHours(hour, rand(0, 59), rand(0, 59), 0);

    const id = `BK-${rand(100000, 999999)}`;
    const city = pick(CITIES);
    const ms = rand(20, 3000);
    const message = pick(MESSAGES[level])
      .replace("{id}", id)
      .replace("{ms}", String(ms))
      .replace("{city}", city)
      .replace("{n}", String(rand(1, 40)));

    const checkIn = new Date(at.getTime() + 86_400_000 * rand(7, 60));
    const request = {
      reference: id,
      city,
      checkIn: checkIn.toISOString().slice(0, 10),
      nights: rand(1, 10),
      rooms: [{ adults: 2, children: rand(0, 2) }],
      currency: "AED",
    };
    const response = {
      reference: id,
      status: level === "ERROR" || level === "FATAL" ? "Failed" : "Success",
      durationMs: ms,
      offers: rand(0, 40),
      totalPrice: Number((rand(30000, 900000) / 100).toFixed(2)),
    };

    const url =
      `${ENDPOINTS[area]}?reference=${id}&city=${encodeURIComponent(city)}` +
      `&checkIn=${request.checkIn}&nights=${request.nights}`;

    const exception =
      level === "ERROR" || level === "FATAL"
        ? `\n    <exception>${escapeXml(stackTrace(area))}</exception>`
        : "";

    entries.push(
      `  <entry timestamp="${at.toISOString()}" level="${level}" ` +
        `logger="${pick(LOGGERS[area])}" thread="${rand(10, 50)}" ` +
        `machine="${pick(MACHINES)}" user="${pick(USERS)}">\n` +
        `    <message>${escapeXml(message)}</message>\n` +
        `    <requestUrl>${escapeXml(url)}</requestUrl>\n` +
        `    <requestJson>${escapeXml(JSON.stringify(request))}</requestJson>\n` +
        `    <responseJson>${escapeXml(JSON.stringify(response))}</responseJson>${exception}\n` +
        `  </entry>`,
    );
  }

  return `<?xml version="1.0" encoding="utf-8"?>\n<log area="${area}">\n${entries.join("\n")}\n</log>\n`;
}

fs.rmSync(root, { recursive: true, force: true });

let fileCount = 0;
const today = new Date();

for (const [section, categories] of Object.entries(LAYOUT)) {
  for (const category of categories) {
    const area = category || section;

    for (let d = 0; d < days; d += 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - d);
      const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

      const dir = path.join(root, section, category, day);
      fs.mkdirSync(dir, { recursive: true });

      for (const hour of [8, 13, 19]) {
        const stamp = `${day.replace(/-/g, "")}_${pad(hour)}0000`;
        fs.writeFileSync(
          path.join(dir, `${area}_${stamp}.xml`),
          buildFile(area, date, hour, section === "ErrorLog"),
        );
        fileCount += 1;
      }
    }
  }
}

// One plain-text log per day to exercise the non-XML parser.
for (let d = 0; d < Math.min(days, 2); d += 1) {
  const date = new Date(today);
  date.setDate(today.getDate() - d);
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  const dir = path.join(root, "PortalWeb", day);
  fs.mkdirSync(dir, { recursive: true });

  const lines = [];
  for (let i = 0; i < 120; i += 1) {
    const at = new Date(date.getTime() - i * 60_000);
    const level = pickLevel(false);
    lines.push(
      `${at.toISOString().replace("T", " ").slice(0, 23)} [${level}] PortalWeb.RequestPipeline - ` +
        `GET https://portal.myholidays.com/api/search?city=${pick(CITIES)} took ${rand(20, 900)} ms`,
    );
  }

  fs.writeFileSync(
    path.join(dir, `PortalWeb_${day.replace(/-/g, "")}_000000.log`),
    `${lines.reverse().join("\n")}\n`,
  );
  fileCount += 1;
}

console.log(`Generated ${fileCount} log files under ${root}`);
