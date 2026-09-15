import type { LogFile } from "@/lib/logs";

/**
 * Log trees are organised as <Section>[/<Category>...]/<date folder(s)>/<file>, e.g.
 *   ErrorLog\2026-09-15\...            Hotel\HotelBook\20260915\...
 * Date folders are either one folder holding a full date or a Y/M/D chain.
 */
export type FileGroup = {
  date: string | null;
  label: string;
  files: LogFile[];
  sizeBytes: number;
};

export type Category = {
  name: string;
  path: string;
  fileCount: number;
  sizeBytes: number;
  lastModifiedAt: string | null;
  days: FileGroup[];
};

export type Section = {
  name: string;
  path: string;
  fileCount: number;
  sizeBytes: number;
  lastModifiedAt: string | null;
  categories: Category[];
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function iso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

/** Parses a full date out of a single folder name (2026-09-15, 20260915, 15-09-2026, 15-Sep-2026). */
export function folderDate(name: string): string | null {
  const value = name.trim();

  let match = value.match(/^(\d{4})[-_.]?(\d{2})[-_.]?(\d{2})$/);
  if (match) return iso(+match[1], +match[2], +match[3]);

  match = value.match(/^(\d{2})[-_.]?(\d{2})[-_.]?(\d{4})$/);
  if (match) return iso(+match[3], +match[2], +match[1]);

  match = value.match(/^(\d{1,2})[-_. ]([A-Za-z]{3,})[-_. ](\d{4})$/);
  if (match) {
    const month = MONTHS[match[2].slice(0, 3).toLowerCase()];
    if (month) return iso(+match[3], month, +match[1]);
  }

  return null;
}

/** Splits a relative path into its section/category part and the date it belongs to. */
export function splitPath(file: LogFile): {
  section: string;
  category: string;
  categoryPath: string;
  date: string | null;
} {
  const segments = file.relativePath.split(/[\\/]/).slice(0, -1);
  const section = segments[0] ?? "(root)";

  const categories: string[] = [];
  let date: string | null = null;

  for (let i = 1; i < segments.length; i += 1) {
    const single = folderDate(segments[i]);
    if (single) {
      date = single;
      break;
    }

    const [year, month, day] = segments.slice(i, i + 3);
    if (/^\d{4}$/.test(year ?? "") && /^\d{1,2}$/.test(month ?? "") && /^\d{1,2}$/.test(day ?? "")) {
      date = iso(+year, +month, +day);
      break;
    }

    categories.push(segments[i]);
  }

  if (!date) {
    const fallback = file.nameTimestamp ?? file.modifiedAt;
    date = fallback ? fallback.slice(0, 10) : null;
  }

  return {
    section,
    category: categories.join(" / "),
    categoryPath: [section, ...categories].join("/"),
    date,
  };
}

function newest(a: string | null, b: string): string {
  return !a || b > a ? b : a;
}

export function buildSections(files: LogFile[]): Section[] {
  const sections = new Map<string, Section>();

  for (const file of files) {
    const { section: sectionName, category, categoryPath, date } = splitPath(file);

    let section = sections.get(sectionName);
    if (!section) {
      section = {
        name: sectionName,
        path: sectionName,
        fileCount: 0,
        sizeBytes: 0,
        lastModifiedAt: null,
        categories: [],
      };
      sections.set(sectionName, section);
    }
    section.fileCount += 1;
    section.sizeBytes += file.sizeBytes;
    section.lastModifiedAt = newest(section.lastModifiedAt, file.modifiedAt);

    let bucket = section.categories.find((item) => item.path === categoryPath);
    if (!bucket) {
      bucket = {
        name: category || sectionName,
        path: categoryPath,
        fileCount: 0,
        sizeBytes: 0,
        lastModifiedAt: null,
        days: [],
      };
      section.categories.push(bucket);
    }
    bucket.fileCount += 1;
    bucket.sizeBytes += file.sizeBytes;
    bucket.lastModifiedAt = newest(bucket.lastModifiedAt, file.modifiedAt);

    let day = bucket.days.find((item) => item.date === date);
    if (!day) {
      day = { date, label: date ?? "undated", files: [], sizeBytes: 0 };
      bucket.days.push(day);
    }
    day.files.push(file);
    day.sizeBytes += file.sizeBytes;
  }

  const byDateDesc = (a: FileGroup, b: FileGroup) => (b.date ?? "").localeCompare(a.date ?? "");

  for (const section of sections.values()) {
    section.categories.sort((a, b) => a.name.localeCompare(b.name));
    for (const category of section.categories) {
      category.days.sort(byDateDesc);
      for (const day of category.days) {
        day.files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
      }
    }
  }

  return [...sections.values()].sort((a, b) => a.name.localeCompare(b.name));
}
