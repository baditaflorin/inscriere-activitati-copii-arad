import { z } from "zod";
import catalogJson from "./data/catalog.json";

export const sessionSchema = z.object({
  location: z.string(),
  address: z.string(),
  room: z.string().optional(),
  schedule: z.string(),
  coordinator: z.string(),
});

export const circleSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  detailsUrl: z.string().optional(),
  sessions: z.array(sessionSchema).optional().default([]),
});

export const catalogSchema = z.object({
  version: z.string(),
  generatedAt: z.string(),
  sources: z.array(
    z.object({
      name: z.string(),
      url: z.string(),
      retrievedAt: z.string(),
      sha256: z.string().optional(),
    }),
  ),
  enrollment: z.object({
    schoolYear: z.string(),
    period: z.string(),
    email: z.string(),
    pdfUrl: z.string(),
    requiredDocuments: z.array(z.string()),
    submissionMethods: z.array(z.string()),
  }),
  circles: z.array(circleSchema),
});

export type Catalog = z.infer<typeof catalogSchema>;
export type Circle = z.infer<typeof circleSchema>;

export const catalog = catalogSchema.parse(catalogJson);

export const categories = Array.from(new Set(catalog.circles.map((circle) => circle.category))).sort();

export function circlesByID() {
  return new Map(catalog.circles.map((circle) => [circle.id, circle]));
}
