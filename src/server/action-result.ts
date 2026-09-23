import "server-only";
import { z } from "zod";
import { AuthError } from "@/lib/auth/session";

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string>; code?: "auth" | "conflict" | "validation" };

/** An error whose message is safe and useful to show to the person. */
export class UserError extends Error {
  constructor(
    message: string,
    public readonly code: "conflict" | "validation" = "validation",
  ) {
    super(message);
    this.name = "UserError";
  }
}

function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * Wrap a server action body: expected failures become friendly messages,
 * unexpected ones are logged with context and never leak internals to the client.
 */
export async function runAction<T>(name: string, fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message, code: "auth" };
    if (error instanceof UserError) return { ok: false, error: error.message, code: error.code };
    if (error instanceof z.ZodError) {
      return { ok: false, error: "Some details need another look.", fieldErrors: fieldErrorsOf(error), code: "validation" };
    }
    // Next.js uses thrown errors for redirects/notFound; let those through.
    if (error && typeof error === "object" && "digest" in error && typeof error.digest === "string" && error.digest.startsWith("NEXT_")) {
      throw error;
    }
    console.error(JSON.stringify({ level: "error", action: name, message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined }));
    return { ok: false, error: "Something went wrong on our side. Your changes were not saved; please try again." };
  }
}
