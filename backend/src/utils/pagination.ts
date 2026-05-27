export type Pagination = {
  page: number;
  perPage: number;
  offset: number;
};

export function parsePagination(query: Record<string, unknown>, maxPerPage = 50): Pagination {
  const page = Math.max(Number(query.page ?? 1) || 1, 1);
  const perPage = Math.min(Math.max(Number(query.perPage ?? 12) || 12, 1), maxPerPage);
  return { page, perPage, offset: (page - 1) * perPage };
}

export function jsonArray(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function cleanLike(value: unknown) {
  return typeof value === 'string' && value.trim() ? `%${value.trim()}%` : undefined;
}
