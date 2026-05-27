import { z } from "zod";

const envSchema = z.object({
  apiUrl: z.string().url(),
});

export const env = envSchema.parse({
  apiUrl: import.meta.env.VITE_API_URL ?? "http://localhost:3000",
});

export type AppEnv = z.infer<typeof envSchema>;
