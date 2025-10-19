import { CrashRow, GeoJSONFeature, GeoJSONFeatureCollection } from "./types";

export function rowsToGeoJSON(rows: CrashRow[]): GeoJSONFeatureCollection {
  const features: GeoJSONFeature[] = [];
  for (const row of rows) {
    let lon: number | undefined;
    let lat: number | undefined;
    if (row.location && Array.isArray(row.location.coordinates)) {
      const [x, y] = row.location.coordinates;
      lon = typeof x === "string" ? parseFloat(x) : x;
      lat = typeof y === "string" ? parseFloat(y) : y;
    } else if (row.longitude != null && row.latitude != null) {
      const x =
        typeof row.longitude === "string"
          ? parseFloat(row.longitude)
          : row.longitude;
      const y =
        typeof row.latitude === "string"
          ? parseFloat(row.latitude)
          : row.latitude;
      lon = x as number;
      lat = y as number;
    }
    if (lon == null || lat == null || Number.isNaN(lon) || Number.isNaN(lat))
      continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: {
        severity: row.severity ?? null,
        date: row.collision_date ?? row.crash_date ?? null,
        county: row.county ?? row.county_name ?? null,
      },
    });
  }
  return { type: "FeatureCollection", features };
}
