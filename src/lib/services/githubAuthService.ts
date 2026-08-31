import { eq } from "drizzle-orm";
import { db } from "@/db";
import { githubAccounts, users } from "@/db/schema";
import { ApiError } from "@/lib/api/errors";
import type { GithubViewer } from "@/lib/github/client";

export type AccountResolution =
  | { action: "login"; userId: string }
  | { action: "link"; userId: string }
  | { action: "create" }
  | { action: "reject"; reason: string };

const UNVERIFIED_EMAIL_MESSAGE =
  "GitHub ne fournit pas d'adresse email primaire vérifiée pour ce compte. Vérifie ton email sur GitHub, puis réessaie.";

/**
 * Décision pure de résolution de compte (spec §4.2). Extraite de l'accès base pour être testable
 * sans PostgreSQL — c'est la règle qui compte, pas les requêtes.
 *
 * L'ordre importe : une identité GitHub déjà liée prouve le compte, elle prime sur tout le reste.
 * Le rattachement par email n'est jamais fait sur une adresse non vérifiée — n'importe qui pourrait
 * sinon revendiquer l'adresse d'un compte existant et en prendre le contrôle.
 */
export function decideAccountResolution(input: {
  identityUserId: string | null;
  hasVerifiedEmail: boolean;
  userIdWithSameEmail: string | null;
}): AccountResolution {
  if (input.identityUserId) {
    return { action: "login", userId: input.identityUserId };
  }
  if (!input.hasVerifiedEmail) {
    return { action: "reject", reason: UNVERIFIED_EMAIL_MESSAGE };
  }
  if (input.userIdWithSameEmail) {
    return { action: "link", userId: input.userIdWithSameEmail };
  }
  return { action: "create" };
}

/** Applique la décision ci-dessus et rafraîchit le profil GitHub stocké à chaque connexion. */
export async function resolveGithubAccount(
  viewer: GithubViewer,
  accessToken: string,
  scope: string
): Promise<{ userId: string; isNew: boolean }> {
  const identity = await db.query.githubAccounts.findFirst({
    where: eq(githubAccounts.githubUserId, viewer.githubUserId),
  });
  const email = viewer.email?.toLowerCase() ?? null;
  const sameEmail = email ? await db.query.users.findFirst({ where: eq(users.email, email) }) : null;

  const decision = decideAccountResolution({
    identityUserId: identity?.userId ?? null,
    hasVerifiedEmail: Boolean(email),
    userIdWithSameEmail: sameEmail?.id ?? null,
  });

  const profile = {
    login: viewer.login,
    name: viewer.name,
    bio: viewer.bio,
    avatarUrl: viewer.avatarUrl,
    accessToken,
    scope,
  };

  if (decision.action === "reject") {
    throw new ApiError(409, decision.reason);
  }

  if (decision.action === "login") {
    await db.update(githubAccounts).set(profile).where(eq(githubAccounts.userId, decision.userId));
    return { userId: decision.userId, isNew: false };
  }

  if (decision.action === "link") {
    // onboardingTrack délibérément NON modifié : un compte créateur qui se connecte via GitHub
    // reste en parcours créateur (spec §10).
    await db.insert(githubAccounts).values({ userId: decision.userId, githubUserId: viewer.githubUserId, ...profile });
    return { userId: decision.userId, isNew: false };
  }

  const [user] = await db
    .insert(users)
    .values({ email: email!, passwordHash: null, onboardingTrack: "dev" })
    .returning({ id: users.id });
  await db.insert(githubAccounts).values({ userId: user.id, githubUserId: viewer.githubUserId, ...profile });
  return { userId: user.id, isNew: true };
}
