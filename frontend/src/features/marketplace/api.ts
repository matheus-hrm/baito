import { z } from "zod";

import { authHeader, deleteJson, getJson, patchJson, postJson } from "../../shared/api/http";

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

const tagsSchema = z.preprocess((value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}, z.array(z.string()));

const listingSchema = z.object({
  id: z.string(),
  providerId: z.string(),
  providerUserId: z.string(),
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
  tags: tagsSchema,
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

const contractDetailSchema = contractSchema.extend({
  description: z.string().nullable(),
  clientId: z.string(),
  providerId: z.string(),
  providerUserId: z.string(),
  listingId: z.string().nullable(),
  scheduledAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  cancelReason: z.string().nullable(),
});

const messageSchema = z.object({
  id: z.string(),
  senderId: z.string(),
  receiverId: z.string(),
  content: z.string(),
  isRead: z.union([z.boolean(), z.number()]).transform(Boolean),
  createdAt: z.string(),
  contractId: z.string().nullable(),
});

export type AuthUser = z.infer<typeof userSchema>;
export type Listing = z.infer<typeof listingSchema>;
export type Provider = z.infer<typeof providerSchema>;
export type Contract = z.infer<typeof contractSchema>;
export type ContractDetail = z.infer<typeof contractDetailSchema>;
export type Message = z.infer<typeof messageSchema>;

export type ListingInput = {
  title: string;
  description: string;
  categoryId?: string | null;
  price?: number | null;
  priceType: "fixed" | "hourly" | "daily" | "negotiable";
  tags: string[];
};

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

export function createListing(token: string, input: ListingInput) {
  return postJson("/api/listings", input, z.object({ data: listingSchema }), { headers: authHeader(token) });
}

export function updateListing(token: string, id: string, input: ListingInput) {
  return patchJson(`/api/listings/${id}`, input, z.object({ data: listingSchema }), { headers: authHeader(token) });
}

export function deleteListing(token: string, id: string) {
  return deleteJson(`/api/listings/${id}`, z.object({ data: z.object({ ok: z.boolean() }) }), { headers: authHeader(token) });
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

export function getContract(token: string, id: string) {
  return getJson(`/api/contracts/${id}`, z.object({ data: contractDetailSchema }), { headers: authHeader(token) });
}

export function acceptContract(token: string, id: string) {
  return patchJson(`/api/contracts/${id}/accept`, {}, z.object({ data: contractDetailSchema }), { headers: authHeader(token) });
}

export function startContract(token: string, id: string) {
  return patchJson(`/api/contracts/${id}/start`, {}, z.object({ data: contractDetailSchema }), { headers: authHeader(token) });
}

export function completeContract(token: string, id: string) {
  return patchJson(`/api/contracts/${id}/complete`, {}, z.object({ data: contractDetailSchema }), { headers: authHeader(token) });
}

export function confirmContract(token: string, id: string) {
  return patchJson(`/api/contracts/${id}/confirm`, {}, z.object({ data: contractDetailSchema }), { headers: authHeader(token) });
}

export function cancelContract(token: string, id: string, reason?: string) {
  return patchJson(`/api/contracts/${id}/cancel`, { reason }, z.object({ data: contractDetailSchema }), { headers: authHeader(token) });
}

export function sendMessage(token: string, input: { receiverId: string; content: string; contractId?: string }) {
  return postJson("/api/messages", input, z.object({ data: messageSchema }), { headers: authHeader(token) });
}

export function listMessages(token: string, userId: string) {
  return getJson(`/api/messages/conversations/${userId}`, z.object({ data: z.array(messageSchema) }), { headers: authHeader(token) });
}

export function markMessagesRead(token: string, userId: string) {
  return patchJson(`/api/messages/conversations/${userId}/read`, {}, z.object({ data: z.object({ updated: z.number() }) }), { headers: authHeader(token) });
}

export function createPaymentIntent(token: string, contractId: string) {
  return postJson("/api/payments/payment-intent", { contractId }, z.object({ data: z.object({ url: z.string() }) }), { headers: authHeader(token) });
}
