import { z } from "zod";

import { authHeader, getJson, postJson } from "../../shared/api/http";

const metaSchema = z.object({ page: z.number(), perPage: z.number(), total: z.number() });

const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(["client", "provider"]),
});

const authResponseSchema = z.object({
  data: z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
    user: userSchema,
  }),
});

const listingSchema = z.object({
  id: z.string(),
  providerId: z.string(),
  providerName: z.string(),
  providerRating: z.number().nullable(),
  providerReviews: z.number().nullable(),
  location: z.string().nullable(),
  categoryId: z.string().nullish(),
  categoryName: z.string().nullable(),
  categorySlug: z.string().nullable(),
  categoryIcon: z.string().nullable(),
  title: z.string(),
  description: z.string(),
  price: z.number().nullable(),
  priceType: z.string(),
  priceCurrency: z.string(),
  tags: z.array(z.string()),
  status: z.string().optional(),
  views: z.number(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

const providerSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  description: z.string(),
  location: z.string().nullable(),
  averageRating: z.number().nullable(),
  totalReviews: z.number().nullable(),
  totalContracts: z.number().nullable(),
  isVerified: z.union([z.boolean(), z.number()]).transform(Boolean),
  categoryName: z.string().nullable(),
  categorySlug: z.string().nullable(),
  categoryIcon: z.string().nullable(),
});

const contractSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  agreedPrice: z.number().nullable(),
  currency: z.string(),
  createdAt: z.string(),
  clientName: z.string(),
  providerName: z.string(),
  listingTitle: z.string().nullable(),
});

export type AuthUser = z.infer<typeof userSchema>;
export type Listing = z.infer<typeof listingSchema>;
export type Provider = z.infer<typeof providerSchema>;
export type Contract = z.infer<typeof contractSchema>;

export function loginUser(input: { email: string; password: string }) {
  return postJson("/api/auth/login", input, authResponseSchema);
}

export function registerUser(input: { name: string; email: string; password: string; role: "client" | "provider" }) {
  return postJson("/api/auth/register", input, authResponseSchema);
}

export function getMe(token: string) {
  return getJson("/api/users/me", z.object({ data: userSchema.extend({ bio: z.string().nullable(), phone: z.string().nullable() }) }), {
    headers: authHeader(token),
  });
}

export function listListings(params: { category?: string; q?: string; perPage?: number } = {}) {
  const search = new URLSearchParams();
  if (params.category && params.category !== "all") search.set("category", params.category);
  if (params.q) search.set("q", params.q);
  search.set("perPage", String(params.perPage ?? 12));
  return getJson(`/api/listings?${search.toString()}`, z.object({ data: z.array(listingSchema), meta: metaSchema }));
}

export function getListing(id: string) {
  return getJson(`/api/listings/${id}`, z.object({ data: listingSchema }));
}

export function listProviders(params: { category?: string; q?: string; perPage?: number } = {}) {
  const search = new URLSearchParams();
  if (params.category && params.category !== "all") search.set("category", params.category);
  if (params.q) search.set("q", params.q);
  search.set("perPage", String(params.perPage ?? 12));
  return getJson(`/api/providers?${search.toString()}`, z.object({ data: z.array(providerSchema), meta: metaSchema }));
}

export function getProvider(id: string) {
  return getJson(
    `/api/providers/${id}`,
    z.object({
      data: z.object({
        provider: providerSchema.extend({
          userId: z.string(),
          userEmail: z.string(),
          companyName: z.string().nullable(),
          website: z.string().nullable(),
        }),
        listings: z.array(listingSchema.pick({
          id: true,
          title: true,
          description: true,
          price: true,
          priceType: true,
          priceCurrency: true,
          tags: true,
          views: true,
          createdAt: true,
        })),
        reviews: z.array(z.object({
          id: z.string(),
          rating: z.number(),
          comment: z.string().nullable(),
          createdAt: z.string(),
          reviewerName: z.string(),
        })),
      }),
    }),
  );
}

export function createProvider(token: string, input: { displayName: string; description: string; categoryId?: string; location?: string }) {
  return postJson("/api/providers", input, z.object({ data: z.unknown() }), { headers: authHeader(token) });
}

export function createListing(token: string, input: { title: string; description: string; categoryId?: string; price?: number; priceType: "fixed" | "hourly" | "daily" | "negotiable"; tags: string[] }) {
  return postJson("/api/listings", input, z.object({ data: listingSchema }), { headers: authHeader(token) });
}

export function createContract(token: string, input: { providerId: string; listingId?: string; title: string; description?: string; agreedPrice?: number }) {
  return postJson("/api/contracts", input, z.object({ data: z.unknown() }), { headers: authHeader(token) });
}

export function listContracts(token: string) {
  return getJson("/api/contracts", z.object({ data: z.array(contractSchema), meta: metaSchema }), { headers: authHeader(token) });
}

export function listMyListings(token: string) {
  return getJson("/api/listings/mine", z.object({ data: z.array(listingSchema.partial().extend({ id: z.string(), title: z.string(), tags: z.array(z.string()) })) }), {
    headers: authHeader(token),
  });
}

export function listConversations(token: string) {
  return getJson(
    "/api/messages/conversations",
    z.object({ data: z.array(z.object({ userId: z.string(), userName: z.string(), lastMessageAt: z.string(), unread: z.number() })) }),
    { headers: authHeader(token) },
  );
}
