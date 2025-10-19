import { CrashFilters, CrashRow } from "./types";

const DOMAIN = process.env.SOCRATA_DOMAIN ?? "data.chhs.ca.gov";
const DATASET = process.env.SOCRATA_DATASET_ID ?? ""; // TODO: set actual 4x4 id
const APP_TOKEN = process.env.SOCRATA_APP_TOKEN;

function encodeParams(
  params: Record<string, string | number | undefined>
): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === "") continue;
    usp.set(k, String(v));
  }
  return usp.toString();
}

export function buildWhere(
  filters: CrashFilters & { hasLocation: boolean }
): string {
  const parts: string[] = [];
  const { bbox, start, end, severity, county, hasLocation } = filters;
  if (start) parts.push(`collision_date >= '${start}T00:00:00'`);
  if (end) parts.push(`collision_date <= '${end}T23:59:59'`);
  if (severity && severity.length)
    parts.push(`severity in (${severity.map((s) => `'${s}'`).join(",")})`);
  if (county && county.length)
    parts.push(
      `upper(county) in (${county
        .map((c) => `'${c.toUpperCase()}'`)
        .join(",")})`
    );
  if (bbox) {
    if (hasLocation) {
      parts.push(
        `within_box(location, ${bbox.maxLat}, ${bbox.maxLon}, ${bbox.minLat}, ${bbox.minLon})`
      );
    } else {
      parts.push(
        `latitude between ${bbox.minLat} and ${bbox.maxLat} and longitude between ${bbox.minLon} and ${bbox.maxLon}`
      );
    }
  }
  return parts.join(" AND ");
}

export async function fetchCrashes(
  filters: CrashFilters
): Promise<{ rows: CrashRow[]; truncated: boolean }> {
  if (!DATASET) throw new Error("SOCRATA_DATASET_ID not configured");
  const limit = Math.min(Math.max(filters.limit ?? 5000, 1), 10000);
  const hasLocation = true; // assume location field exists for 2025; adjust if needed
  const where = buildWhere({ ...filters, hasLocation });
  const select = hasLocation
    ? "location, collision_date, severity, county"
    : "latitude, longitude, collision_date, severity, county";
  const url = new URL(`https://${DOMAIN}/resource/${DATASET}.json`);
  const soql: Record<string, string> = {
    $select: select,
    $limit: String(limit),
  };
  if (where) soql.$where = where;
  url.search = encodeParams(soql);

  const headers: Record<string, string> = {};
  if (APP_TOKEN) headers["X-App-Token"] = APP_TOKEN;

  const res = await fetch(url.toString(), { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`Socrata error ${res.status}`);
  const rows = (await res.json()) as CrashRow[];
  const truncated = rows.length >= limit;
  return { rows, truncated };
}
