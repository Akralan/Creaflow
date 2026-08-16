import { afterEach, describe, expect, it, vi } from "vitest";
import * as Sentry from "@sentry/nextjs";
import { logger } from "./logger";

// logger.error() déclenche un import dynamique de @sentry/nextjs (fire-and-forget) — sans ce mock,
// le SDK réel s'initialise pendant les tests (transports, timers internes) et empêche le worker
// Vitest de se terminer proprement. Sert aussi à espionner captureException/captureMessage plus
// bas : logger.error() est censé choisir entre les deux selon la présence d'une exception JS.
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

function lastLoggedEntry(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  const [line] = spy.mock.calls.at(-1) as [string];
  return JSON.parse(line);
}

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    // restoreAllMocks ne réinitialise l'historique des appels que pour les spies créés via
    // vi.spyOn ; les vi.fn() du mock de module (captureException/captureMessage) ont besoin de
    // clearAllMocks en plus pour ne pas fuiter d'un test à l'autre.
    vi.clearAllMocks();
  });

  it("émet une ligne JSON avec level/message/timestamp et le contexte fourni", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("Test info", { userId: "u1" });

    const entry = lastLoggedEntry(spy);
    expect(entry).toMatchObject({ level: "info", message: "Test info", userId: "u1" });
    expect(typeof entry.timestamp).toBe("string");
  });

  it("route warn/error vers console.warn/console.error, pas console.log", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    logger.warn("Test warn");
    logger.error("Test error");

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("sérialise une Error en {message, stack} sous la clé error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("Échec", new Error("boom"));

    const entry = lastLoggedEntry(spy);
    expect(entry.error).toMatchObject({ message: "boom" });
    expect((entry.error as { stack?: string }).stack).toContain("Error: boom");
  });

  it("logger.error() avec une exception JS appelle Sentry.captureException (garde la stack)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("boom");

    logger.error("Échec", err, { userId: "u1" });

    await vi.waitFor(() => {
      expect(Sentry.captureException).toHaveBeenCalledWith(err, { extra: { message: "Échec", userId: "u1" } });
    });
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("logger.error() sans exception JS appelle Sentry.captureMessage en level error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    logger.error("Anomalie détectée sans exception", undefined, { sessionId: "s1" });

    await vi.waitFor(() => {
      expect(Sentry.captureMessage).toHaveBeenCalledWith("Anomalie détectée sans exception", {
        level: "error",
        extra: { sessionId: "s1" },
      });
    });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("debug() n'émet que sous NODE_ENV=development (opt-in, pas opt-out)", () => {
    const original = process.env.NODE_ENV;
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    // "test" (valeur fixée par Vitest lui-même pendant `npm run test`) et "production" doivent
    // tous les deux rester silencieux — c'est justement l'inconsistance corrigée (l'ancien garde
    // `!== "production"` laissait passer le bruit sous NODE_ENV=test).
    for (const value of ["test", "production", undefined]) {
      // @ts-expect-error -- NODE_ENV est en lecture seule dans les types Node, réassigné en test
      process.env.NODE_ENV = value;
      logger.debug("Ne doit pas apparaître");
    }
    expect(spy).not.toHaveBeenCalled();

    // @ts-expect-error -- idem
    process.env.NODE_ENV = "development";
    logger.debug("Doit apparaître");
    expect(spy).toHaveBeenCalledTimes(1);

    // @ts-expect-error -- idem
    process.env.NODE_ENV = original;
  });
});
