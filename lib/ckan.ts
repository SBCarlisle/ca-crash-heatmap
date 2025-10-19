import { CrashFilters, CrashRow } from "./types";

const CKAN_SQL_API_BASE =
  process.env.CKAN_SQL_API_BASE ??
  "https://data.ca.gov/api/3/action/datastore_search_sql";
const CKAN_RESOURCE_ID = process.env.CKAN_RESOURCE_ID ?? "";

// Column names can vary; allow override via env. Provide reasonable defaults.
const LAT_FIELD = process.env.CKAN_LAT_FIELD ?? "latitude";
const LON_FIELD = process.env.CKAN_LON_FIELD ?? "longitude";
const DATE_FIELD = process.env.CKAN_DATE_FIELD ?? "collision_date";
const COUNTY_FIELD = process.env.CKAN_COUNTY_FIELD ?? "county";
const SEVERITY_FIELD = process.env.CKAN_SEVERITY_FIELD ?? "severity";
const KILLED_FIELD = process.env.CKAN_KILLED_FIELD ?? "NumberKilled";

type CKANRecord = Record<string, unknown> & {
  latitude?: string | number;
  longitude?: string | number;
  [key: string]: unknown;
};

type CKANResult = {
  success: boolean;
  result?: {
    records?: CKANRecord[];
  };
};

function escapeLiteral(value: string): string {
  // Basic single-quote escape for SQL literal
  return value.replace(/'/g, "''");
}

function quoteIdent(id: string): string {
  // Double-quote identifiers; escape embedded quotes
  return '"' + id.replace(/"/g, '""') + '"';
}

export function buildWhereSQL(filters: CrashFilters): string {
  const parts: string[] = [];
  const { bbox, start, end, severity, county } = filters;
  const dateCol = quoteIdent(DATE_FIELD);
  const latCol = quoteIdent(LAT_FIELD);
  const lonCol = quoteIdent(LON_FIELD);
  const countyCol = quoteIdent(COUNTY_FIELD);
  const sevCol = quoteIdent(SEVERITY_FIELD);
  if (start) parts.push(`${dateCol} >= '${escapeLiteral(start)} 00:00:00'`);
  if (end) parts.push(`${dateCol} <= '${escapeLiteral(end)} 23:59:59'`);
  if (severity && severity.length) {
    const list = severity.map((s) => `'${escapeLiteral(s)}'`).join(",");
    parts.push(`${sevCol} IN (${list})`);
  }
  if (county && county.length) {
    const list = county
      .map((c) => `'${escapeLiteral(c.toUpperCase())}'`)
      .join(",");
    parts.push(`UPPER(${countyCol}) IN (${list})`);
  }
  if (bbox) {
    parts.push(
      `${latCol} BETWEEN ${bbox.minLat} AND ${bbox.maxLat} AND ${lonCol} BETWEEN ${bbox.minLon} AND ${bbox.maxLon}`
    );
  }
  return parts.length ? ` WHERE ${parts.join(" AND ")}` : "";
}

export async function fetchCrashesCKAN(
  filters: CrashFilters
): Promise<{ rows: CrashRow[]; truncated: boolean }> {
  if (!CKAN_RESOURCE_ID) throw new Error("CKAN_RESOURCE_ID not configured");
  const limit = Math.min(Math.max(filters.limit ?? 5000, 1), 10000);

  const select = `${quoteIdent(LAT_FIELD)} as latitude, ${quoteIdent(
    LON_FIELD
  )} as longitude, ${quoteIdent(DATE_FIELD)} as collision_date, ${quoteIdent(
    SEVERITY_FIELD
  )} as severity, ${quoteIdent(COUNTY_FIELD)} as county, ${quoteIdent(
    KILLED_FIELD
  )} as killed`;
  const where = buildWhereSQL(filters);
  const sql = `SELECT ${select} FROM "${CKAN_RESOURCE_ID}"${where} LIMIT ${limit}`;
  const url = `${CKAN_SQL_API_BASE}?sql=${encodeURIComponent(sql)}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`CKAN error ${res.status}`);
  const json: CKANResult = await res.json();
  if (!json.success) throw new Error("CKAN query failed");
  const records: CKANRecord[] = json.result?.records ?? [];
  const rows: CrashRow[] = records.map((r) => ({
    latitude:
      (r.latitude as string | number | undefined) ??
      (r[LAT_FIELD] as string | number | undefined) ??
      null,
    longitude:
      (r.longitude as string | number | undefined) ??
      (r[LON_FIELD] as string | number | undefined) ??
      null,
    collision_date:
      (r.collision_date as string | undefined) ??
      (r[DATE_FIELD] as string | undefined) ??
      null,
    severity:
      (r.severity as string | undefined) ??
      (r[SEVERITY_FIELD] as string | undefined) ??
      null,
    county:
      (r.county as string | undefined) ??
      (r[COUNTY_FIELD] as string | undefined) ??
      null,
    killed:
      (r.killed as string | number | undefined) ??
      (r[KILLED_FIELD] as string | number | undefined) ??
      null,
  }));
  const truncated = records.length >= limit;
  return { rows, truncated };
}

type BinRow = {
  lat_bin: number;
  lon_bin: number;
  n: number;
  first_date?: string;
  last_date?: string;
};

export async function fetchCrashesBinned(
  filters: CrashFilters & { bin: number }
): Promise<{ rows: BinRow[]; truncated: boolean }> {
  const { bbox, start, end, bin } = filters;
  if (!bbox) throw new Error("bbox is required for binning");
  const limit = Math.min(Math.max(filters.limit ?? 5000, 1), 10000);

  const step = bin;
  const lat = '"' + LAT_FIELD.replace(/"/g, '""') + '"';
  const lon = '"' + LON_FIELD.replace(/"/g, '""') + '"';
  const date = '"' + DATE_FIELD.replace(/"/g, '""') + '"';

  const whereParts: string[] = [
    `${lat} IS NOT NULL`,
    `${lon} IS NOT NULL`,
    `${lat} BETWEEN ${bbox.minLat} AND ${bbox.maxLat}`,
    `${lon} BETWEEN ${bbox.minLon} AND ${bbox.maxLon}`,
  ];
  if (start) whereParts.push(`${date} >= '${start} 00:00:00'`);
  if (end) whereParts.push(`${date} <= '${end} 23:59:59'`);
  const where = whereParts.length ? ` WHERE ${whereParts.join(" AND ")}` : "";

  const sql = `SELECT
    ROUND(${lat}::numeric / ${step}, 0) * ${step} AS lat_bin,
    ROUND(${lon}::numeric / ${step}, 0) * ${step} AS lon_bin,
    COUNT(*) AS n,
    MIN(${date}) AS first_date,
    MAX(${date}) AS last_date
  FROM "${CKAN_RESOURCE_ID}"
  ${where}
  GROUP BY lat_bin, lon_bin
  ORDER BY n DESC
  LIMIT ${limit}`;

  const url = `${CKAN_SQL_API_BASE}?sql=${encodeURIComponent(sql)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`CKAN error ${res.status}: ${body || sql}`);
  }
  const json: { success: boolean; result?: { records?: BinRow[] } } =
    await res.json();
  if (!json.success) throw new Error("CKAN query failed");
  const records = json.result?.records ?? [];
  const truncated = records.length >= limit;
  return { rows: records, truncated };
}
