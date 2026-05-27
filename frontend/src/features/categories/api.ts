import { z } from "zod";

import { getJson } from "../../shared/api/http";

export const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  icon: z.string().nullable(),
  description: z.string().nullable(),
});

const categoriesResponseSchema = z.object({
  data: z.array(categorySchema),
});

export type ApiCategory = z.infer<typeof categorySchema>;

export function listCategories() {
  return getJson("/api/categories", categoriesResponseSchema);
}
