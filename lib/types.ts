export type BBox = {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
};

export type CrashFilters = {
  bbox?: BBox;
  start?: string; // YYYY-MM-DD
  end?: string; // YYYY-MM-DD
  severity?: string[];
  county?: string[];
  limit?: number;
};

export type SocrataLocation = {
  latitude?: string | number;
  longitude?: string | number;
  coordinates?: [number, number]; // [lon, lat]
};

export type CrashRow = {
  location?: SocrataLocation | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  collision_date?: string | null;
  crash_date?: string | null;
  severity?: string | null;
  killed?: string | number | null;
  county?: string | null;
  county_name?: string | null;
};

export type GeoJSONFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: Record<string, unknown>;
};

export type GeoJSONFeatureCollection = {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
};
