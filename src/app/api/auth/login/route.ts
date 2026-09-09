import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { enforceRateLimit, getClientIp } from "@/lib/services/rateLimitService";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    // Double limite (IP + email) : l'IP protège contre le spam générique, l'email contre le
    // credential stuffing ciblé sur un compte précis depuis plusieurs IP (botnet). Le check IP est
    // sauté si X-Forwarded-For est absent (self-hosting sans proxy) — voir getClientIp.
    const ip = getClientIp(request);
    if (ip) {
      await enforceRateLimit("login-ip", ip, 10, 15 * 60);
    }

    const body = loginSchema.parse(await request.json());
    const email = body.email.toLowerCase();
    await enforceRateLimit("login-email", email, 5, 15 * 60);

    const user = await db.query.users.findFirst({ where: eq(users.email, email) });
    // Message et comportement inchangés pour un email inconnu : la vérification du mot de passe
    // n'était déjà pas exécutée dans ce cas (court-circuit du `||`), pas de nouvelle différence de
    // timing exploitable.
    if (!user) {
      throw new ApiError(401, "Email ou mot de passe incorrect.");
    }
    // passwordHash est nullable depuis l'arrivée de l'identité GitHub. Sans ce garde, on répondrait
    // "mot de passe incorrect" à quelqu'un qui n'en a simplement jamais eu, ce qui l'enverrait vers
    // un formulaire d'oubli de mot de passe inutile. Ce message révèle qu'un compte GitHub existe
    // pour cette adresse : compromis assumé pour ne pas laisser l'utilisateur dans une impasse, et
    // borné par le rate limit par email juste au-dessus.
    if (!user.passwordHash) {
      throw new ApiError(400, "Ce compte se connecte avec GitHub. Utilise le bouton « Continuer avec GitHub ».");
    }
    if (!(await verifyPassword(body.password, user.passwordHash))) {
      throw new ApiError(401, "Email ou mot de passe incorrect.");
    }

    await setSessionCookie(user.id);

    return NextResponse.json({ user: { id: user.id, email: user.email } });
  } catch (error) {
    return handleApiError(error);
  }
}
