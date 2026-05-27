import { z } from "zod";

import { env } from "../config/env";

export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function requestJson<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const response = await fetch(new URL(path, env.apiUrl), {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError("A API retornou uma resposta de erro.", response.status, payload);
  }

  return schema.parse(payload);
}

export function getJson<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  return requestJson(path, schema, init);
}

export function postJson<T>(path: string, body: unknown, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  return requestJson(path, schema, {
    ...init,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function authHeader(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}
