import { afterEach, describe, expect, it, vi } from "vitest";
import * as Sentry from "@sentry/nextjs";
import { logger } from "./logger";

// logger.error() triggers a dynamic import of @sentry/nextjs (fire-and-forget) — without this mock,
// the real SDK initializes during the tests (transports, internal timers) and prevents the Vitest
// worker from exiting cleanly. Also used to spy on captureException/captureMessage further
// down: logger.error() is supposed to choose between the two depending on whether a JS exception is present.
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
    // restoreAllMocks only resets the call history for spies created via
    // vi.spyOn; the vi.fn() of the module mock (captureException/captureMessage) need
    // clearAllMocks as well so they do not leak from one test to the next.
    vi.clearAllMocks();
  });

  it("emits a JSON line with level/message/timestamp and the supplied context", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("Test info", { userId: "u1" });

    const entry = lastLoggedEntry(spy);
    expect(entry).toMatchObject({ level: "info", message: "Test info", userId: "u1" });
    expect(typeof entry.timestamp).toBe("string");
  });

  it("routes warn/error to console.warn/console.error, not console.log", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    logger.warn("Test warn");
    logger.error("Test error");

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("serializes an Error as {message, stack} under the error key", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("Échec", new Error("boom"));

    const entry = lastLoggedEntry(spy);
    expect(entry.error).toMatchObject({ message: "boom" });
    expect((entry.error as { stack?: string }).stack).toContain("Error: boom");
  });

  it("logger.error() with a JS exception calls Sentry.captureException (keeps the stack)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("boom");

    logger.error("Échec", err, { userId: "u1" });

    await vi.waitFor(() => {
      expect(Sentry.captureException).toHaveBeenCalledWith(err, { extra: { message: "Échec", userId: "u1" } });
    });
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("logger.error() without a JS exception calls Sentry.captureMessage at error level", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    logger.error("Anomaly detected without exception", undefined, { sessionId: "s1" });

    await vi.waitFor(() => {
      expect(Sentry.captureMessage).toHaveBeenCalledWith("Anomaly detected without exception", {
        level: "error",
        extra: { sessionId: "s1" },
      });
    });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("debug() only emits under NODE_ENV=development (opt-in, not opt-out)", () => {
    const original = process.env.NODE_ENV;
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    // "test" (value set by Vitest itself during `npm run test`) and "production" must
    // both stay silent — this is precisely the inconsistency that was fixed (the old guard
    // `!== "production"` let noise through under NODE_ENV=test).
    for (const value of ["test", "production", undefined]) {
      // @ts-expect-error -- NODE_ENV is read-only in the Node types, reassigned in the test
      process.env.NODE_ENV = value;
      logger.debug("Must not appear");
    }
    expect(spy).not.toHaveBeenCalled();

    // @ts-expect-error -- idem
    process.env.NODE_ENV = "development";
    logger.debug("Must appear");
    expect(spy).toHaveBeenCalledTimes(1);

    // @ts-expect-error -- idem
    process.env.NODE_ENV = original;
  });
});
