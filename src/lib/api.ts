import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { isAdminAuthed } from "./admin-auth";
import { sameOrigin } from "./http";

/** Throw from a route handler to return a clean JSON error. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const json = <T,>(data: T, init?: ResponseInit) => NextResponse.json(data, init);
export const jsonError = (status: number, message: string, extra?: Record<string, unknown>) =>
  NextResponse.json({ error: message, ...extra }, { status });

export function handleError(err: unknown): Response {
  if (err instanceof HttpError) return jsonError(err.status, err.message, err.extra);
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) fields[issue.path.join(".") || "_"] ??= issue.message;
    return jsonError(422, err.issues[0]?.message ?? "Invalid input.", { fields });
  }
  const code = (err as { code?: string })?.code;
  if (code === "23505") return jsonError(409, "That already exists.");
  if (code === "23503") return jsonError(409, "That is still in use.");
  // Never log the error object itself: pg errors can embed row values.
  console.error("[api] unhandled error:", code ?? (err as Error)?.message ?? "unknown");
  return jsonError(500, "Something went wrong. Please try again.");
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body.");
  }
  return schema.parse(raw);
}

export function parseQuery<T>(req: Request, schema: ZodType<T>): T {
  const { searchParams } = new URL(req.url);
  return schema.parse(Object.fromEntries(searchParams.entries()));
}

type Params = Record<string, string>;
export type RouteCtx<P extends Params = Params> = { params: Promise<P> };

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function guardOrigin(req: Request) {
  if (MUTATING.has(req.method) && !sameOrigin(req)) throw new HttpError(403, "Forbidden.");
}

/** Public route: Origin check on mutations + uniform error handling. */
export function publicRoute<P extends Params = Params>(
  handler: (req: Request, params: P) => Promise<Response>,
) {
  return async (req: Request, ctx: RouteCtx<P>): Promise<Response> => {
    try {
      guardOrigin(req);
      return await handler(req, await ctx.params);
    } catch (err) {
      return handleError(err);
    }
  };
}

/** Admin route: single env-password admin (src/lib/admin-auth.ts). */
export function adminRoute<P extends Params = Params>(
  handler: (req: Request, params: P) => Promise<Response>,
) {
  return async (req: Request, ctx: RouteCtx<P>): Promise<Response> => {
    try {
      guardOrigin(req);
      if (!(await isAdminAuthed())) throw new HttpError(401, "Unauthorized.");
      return await handler(req, await ctx.params);
    } catch (err) {
      return handleError(err);
    }
  };
}

export function parseId(value: string, label = "id"): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `Invalid ${label}.`);
  return n;
}
