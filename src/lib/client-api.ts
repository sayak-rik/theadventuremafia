"use client";

export class ApiError extends Error {
  constructor(message: string, public status: number, public fields?: Record<string, string>, public data?: Record<string, unknown>) {
    super(message);
  }
}

/** JSON fetch helper for client components. Throws ApiError with the server's message. */
export async function api<T = Record<string, unknown>>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
    headers: opts.body instanceof FormData || opts.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: opts.body === undefined ? undefined : opts.body instanceof FormData ? opts.body : JSON.stringify(opts.body),
  });
  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) {
    throw new ApiError(
      (data.error as string) ?? (res.status === 429 ? "Too many attempts. Please wait a bit." : "Something went wrong. Please try again."),
      res.status,
      data.fields as Record<string, string> | undefined,
      data,
    );
  }
  return data as T;
}
