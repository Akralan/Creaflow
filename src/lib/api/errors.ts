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
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Requête invalide", details: error.flatten() },
      { status: 400 }
    );
  }
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  // Erreur non anticipée (pas un ApiError/ZodError/UnauthorizedError connu) — seul cas remonté à
  // Sentry depuis ce point central : les erreurs "attendues" ci-dessus sont un fonctionnement
  // normal de l'API, pas un incident à signaler.
  logger.error("Erreur serveur non gérée dans une route API", error);
  return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
}
