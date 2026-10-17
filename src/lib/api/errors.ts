import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError } from "@/lib/auth/session";
import { logger } from "@/lib/logger";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid request", details: error.flatten() },
      { status: 400 }
    );
  }
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  // Unanticipated error (not a known ApiError/ZodError/UnauthorizedError) — the only case reported to
  // Sentry from this central point: the "expected" errors above are normal
  // API behaviour, not an incident to report.
  logger.error("Unhandled server error in an API route", error);
  return NextResponse.json({ error: "Server error" }, { status: 500 });
}
