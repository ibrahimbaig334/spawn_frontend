import { APP_ENV } from "@/lib/env";
import type { Page, PageMeta } from "@/lib/api/dto";

/**
 * RFC-7807 problem details as produced by the Spawn API error filter.
 */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status: number;
  detail?: string;
  instance?: string;
  code?: string;
  requestId?: string;
  errors?: { path: string; message: string }[];
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | null;
  readonly fieldErrors: { path: string; message: string }[];
  retryAfterSeconds: number | null;

  constructor(problem: ProblemDetails, fallbackStatus = 0) {
    super(
      problem.detail ||
        problem.title ||
        problem.code ||
        `Request failed (${problem.status ?? fallbackStatus})`,
    );
    this.name = "ApiError";
    this.status = problem.status ?? fallbackStatus;
    this.code = problem.code ?? "INTERNAL_ERROR";
    this.requestId = problem.requestId ?? null;
    this.fieldErrors = problem.errors ?? [];
    this.retryAfterSeconds = null;
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const base = APP_ENV.apiBaseUrl.replace(/\/+$/, "");
  const url = new URL(`${base}${path.startsWith("/") ? path : `/${path}`}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function parseProblem(response: Response): Promise<ProblemDetails> {
  try {
    const text = await response.text();
    if (text) {
      const json = JSON.parse(text) as ProblemDetails & { message?: string };
      if (json.code || json.status) return json;
      if (json.message) {
        return { status: response.status, code: "INTERNAL_ERROR", detail: json.message };
      }
    }
  } catch {
    /* fall through to synthesized problem */
  }
  return { status: response.status, code: "INTERNAL_ERROR", title: response.statusText };
}

/**
 * Core fetch: unwraps { data, meta } envelopes, raises ApiError for anything else.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    const wrapped = new ApiError({
      status: 0,
      code: "NETWORK_ERROR",
      detail: "The API is unreachable. Check that the backend is running.",
    });
    throw wrapped;
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok) {
    const problem = await parseProblem(response);
    const error = new ApiError(problem, response.status);
    const retryAfter = response.headers.get("retry-after");
    if (retryAfter && /^\d+$/.test(retryAfter)) {
      error.retryAfterSeconds = Number(retryAfter);
    }
    throw error;
  }

  if (!contentType.includes("json")) return (await response.text()) as unknown as T;
  return (await response.json()) as T;
}

/** GET returning the full { data, meta } envelope. */
export async function apiPage<T>(
  path: string,
  query?: RequestOptions["query"],
  signal?: AbortSignal,
): Promise<Page<T>> {
  const result = await apiFetch<Page<T>>(path, { query, signal });
  return { data: result.data ?? [], meta: (result.meta ?? {}) as PageMeta };
}

/** GET returning the unwrapped `data` of an envelope. */
export async function apiData<T>(
  path: string,
  query?: RequestOptions["query"],
  signal?: AbortSignal,
): Promise<T> {
  const result = await apiFetch<{ data: T }>(path, { query, signal });
  return result.data;
}

/** POST/PUT/DELETE returning the unwrapped `data`. */
export async function apiMutation<T>(
  path: string,
  body: unknown,
  options: { method?: "POST" | "PUT" | "DELETE"; idempotencyKey?: string } = {},
): Promise<T> {
  const result = await apiFetch<{ data: T }>(path, {
    method: options.method ?? "POST",
    body,
    idempotencyKey: options.idempotencyKey,
  });
  return result.data;
}
