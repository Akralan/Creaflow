import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { enforceRateLimit, getClientIp } from "@/lib/services/rateLimitService";

const signupSchema = z.object({
  email: z.email(),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères."),
});

export async function POST(request: NextRequest) {
  try {
    // Protège contre la création massive de comptes (bot) — plus large que la limite de login,
    // un signup est une action légitime rare par utilisateur réel. Sauté si X-Forwarded-For est
    // absent (self-hosting sans proxy) — voir getClientIp : pas de check plutôt qu'un bucket
    // "unknown" partagé par tous les visiteurs, qui bloquerait tout le monde à la première rafale.
    const ip = getClientIp(request);
    if (ip) {
      await enforceRateLimit("signup-ip", ip, 5, 60 * 60);
    }

    const body = signupSchema.parse(await request.json());
    const email = body.email.toLowerCase();

    const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing) {
      throw new ApiError(409, "Un compte existe déjà avec cet email.");
    }

    const passwordHash = await hashPassword(body.password);
    const [user] = await db
      .insert(users)
      .values({ email, passwordHash })
      .returning({ id: users.id, email: users.email });

    await setSessionCookie(user.id);

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
