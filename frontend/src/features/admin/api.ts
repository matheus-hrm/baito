import { z } from "zod";

import { authHeader, getJson, postJson } from "../../shared/api/http";

const adminSchema = z.object({
  email: z.string().email(),
  scope: z.literal("admin"),
});

const loginResponseSchema = z.object({
  data: z.object({
    accessToken: z.string(),
    admin: adminSchema,
  }),
});

const groupedCountSchema = z.object({
  key: z.string(),
  total: z.number(),
});

const overviewResponseSchema = z.object({
  data: z.object({
    users: z.object({
      total: z.number(),
      clients: z.number(),
      providers: z.number(),
      active: z.number(),
      verified: z.number(),
      byRole: z.array(groupedCountSchema),
    }),
    providers: z.object({
      total: z.number(),
      verified: z.number(),
      withCategory: z.number(),
    }),
    listings: z.object({
      total: z.number(),
      byStatus: z.array(groupedCountSchema),
    }),
    contracts: z.object({
      total: z.number(),
      byStatus: z.array(groupedCountSchema),
    }),
    messages: z.object({
      total: z.number(),
      unread: z.number(),
    }),
    reviews: z.object({
      total: z.number(),
      public: z.number(),
    }),
  }),
});

const observabilityResponseSchema = z.object({
  data: z.object({
    api: z.object({
      status: z.string(),
      uptimeSeconds: z.number(),
      memory: z.object({
        rss: z.number(),
        heapTotal: z.number(),
        heapUsed: z.number(),
        external: z.number(),
        arrayBuffers: z.number().optional(),
      }),
      node: z.string(),
      environment: z.string(),
    }),
    database: z.object({
      status: z.string(),
      journalMode: z.string(),
      foreignKeys: z.boolean(),
      pageCount: z.number(),
      pageSize: z.number(),
      approximateSizeBytes: z.number(),
      migrations: z.array(z.object({ id: z.string(), appliedAt: z.string() })),
    }),
  }),
});

const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
  phone: z.string().nullable(),
  isVerified: z.union([z.boolean(), z.number()]).transform(Boolean),
  isActive: z.union([z.boolean(), z.number()]).transform(Boolean),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const providerSchema = z.object({
  id: z.string(),
  userId: z.string(),
  userName: z.string(),
  userEmail: z.string(),
  companyName: z.string().nullable(),
  displayName: z.string(),
  description: z.string(),
  location: z.string().nullable(),
  website: z.string().nullable(),
  averageRating: z.number().nullable(),
  totalReviews: z.number().nullable(),
  totalContracts: z.number().nullable(),
  isVerified: z.union([z.boolean(), z.number()]).transform(Boolean),
  categoryName: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const listingSchema = z.object({
  id: z.string(),
  providerId: z.string(),
  providerName: z.string(),
  title: z.string(),
  price: z.number().nullable(),
  priceType: z.string(),
  priceCurrency: z.string(),
  status: z.string(),
  views: z.number(),
  categoryName: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const contractSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  agreedPrice: z.number().nullable(),
  currency: z.string(),
  clientName: z.string(),
  clientEmail: z.string(),
  providerUserName: z.string(),
  providerUserEmail: z.string(),
  providerName: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const metaSchema = z.object({
  page: z.number(),
  perPage: z.number(),
  total: z.number(),
});

function paginatedResponse<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    meta: metaSchema,
  });
}

export type AdminOverview = z.infer<typeof overviewResponseSchema>["data"];
export type AdminObservability = z.infer<typeof observabilityResponseSchema>["data"];
export type AdminUser = z.infer<typeof userSchema>;
export type AdminProvider = z.infer<typeof providerSchema>;
export type AdminListing = z.infer<typeof listingSchema>;
export type AdminContract = z.infer<typeof contractSchema>;

export function loginAdmin(input: { email: string; password: string }) {
  return postJson("/api/admin/login", input, loginResponseSchema);
}

export function getAdminOverview(token: string) {
  return getJson("/api/admin/overview", overviewResponseSchema, { headers: authHeader(token) });
}

export function getAdminObservability(token: string) {
  return getJson("/api/admin/observability", observabilityResponseSchema, { headers: authHeader(token) });
}

export function listAdminUsers(token: string) {
  return getJson("/api/admin/users?perPage=10", paginatedResponse(userSchema), { headers: authHeader(token) });
}

export function listAdminProviders(token: string) {
  return getJson("/api/admin/providers?perPage=10", paginatedResponse(providerSchema), { headers: authHeader(token) });
}

export function listAdminListings(token: string) {
  return getJson("/api/admin/listings?perPage=10", paginatedResponse(listingSchema), { headers: authHeader(token) });
}

export function listAdminContracts(token: string) {
  return getJson("/api/admin/contracts?perPage=10", paginatedResponse(contractSchema), { headers: authHeader(token) });
}
