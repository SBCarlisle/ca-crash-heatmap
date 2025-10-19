import { NextRequest, NextResponse } from "next/server";
import { filtersSchema } from "@/lib/validate";
// import { fetchCrashes } from "@/lib/socrata";
import { fetchCrashesCKAN, fetchCrashesBinned } from "@/lib/ckan";
import { rowsToGeoJSON } from "@/lib/geo";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bboxParam = searchParams.get("bbox");
    const start = searchParams.get("start") ?? undefined;
    const end = searchParams.get("end") ?? undefined;
    const severity = searchParams.getAll("severity");
    const county = searchParams.getAll("county");
    const limit = searchParams.get("limit") ?? undefined;

    const bbox = bboxParam
      ? (() => {
          const [minLon, minLat, maxLon, maxLat] = bboxParam
            .split(",")
            .map(Number);
          return { minLon, minLat, maxLon, maxLat };
        })()
      : undefined;

    const modeParam = searchParams.get("mode");
    const mode =
      modeParam === "bin"
        ? "bin"
        : modeParam === "points"
        ? "points"
        : undefined;
    const parsed = filtersSchema.safeParse({
      bbox,
      start,
      end,
      severity: severity.length ? severity : undefined,
      county: county.length ? county : undefined,
      limit,
      mode,
      bin: searchParams.get("bin") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (parsed.data.mode === "bin" && parsed.data.bin) {
      const { rows, truncated } = await fetchCrashesBinned({
        ...parsed.data,
        bin: parsed.data.bin,
      });
      const features = rows.map((r) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [r.lon_bin, r.lat_bin] as [number, number],
        },
        properties: {
          count: r.n,
          first_date: r.first_date ?? null,
          last_date: r.last_date ?? null,
        },
      }));
      const geo = { type: "FeatureCollection" as const, features };
      const res = NextResponse.json(geo, { status: 200 });
      res.headers.set("X-Result-Truncated", String(truncated));
      res.headers.set(
        "Cache-Control",
        "s-maxage=30, stale-while-revalidate=60"
      );
      return res;
    }

    const { rows, truncated } = await fetchCrashesCKAN(parsed.data);
    const geo = rowsToGeoJSON(rows);
    const res = NextResponse.json(geo, { status: 200 });
    res.headers.set("X-Result-Truncated", String(truncated));
    res.headers.set("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    return res;
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
