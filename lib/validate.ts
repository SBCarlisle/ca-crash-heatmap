import { z } from "zod";

export const bboxSchema = z
  .object({
    minLon: z.coerce.number().gte(-180).lte(180),
    minLat: z.coerce.number().gte(-90).lte(90),
    maxLon: z.coerce.number().gte(-180).lte(180),
    maxLat: z.coerce.number().gte(-90).lte(90),
  })
  .refine((b) => b.maxLon > b.minLon && b.maxLat > b.minLat, {
    message: "Invalid bbox",
  });

export const filtersSchema = z
  .object({
    bbox: bboxSchema.optional(),
    start: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    end: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    severity: z.array(z.string()).max(10).optional(),
    county: z.array(z.string()).max(20).optional(),
    limit: z.coerce.number().int().positive().max(10000).optional(),
    mode: z.enum(["points", "bin"]).optional(),
    bin: z.coerce.number().gt(0).lte(0.25).optional(),
  })
  .refine((v) => v.mode !== "bin" || typeof v.bin === "number", {
    message: "bin is required when mode=bin",
    path: ["bin"],
  });

export type FiltersInput = z.infer<typeof filtersSchema>;
