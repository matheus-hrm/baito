import { z } from 'zod';

export const adminLoginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1).max(200),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
