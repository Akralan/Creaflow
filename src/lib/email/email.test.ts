import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "@/lib/logger";
import { createBrevoSender } from "./brevo";
import { getEmailSender, parseSenderIdentity } from "./index";
import { consoleSender } from "./console";
import { accountDeletedEmail, firstPostEmail, loginLinkEmail } from "./templates";

describe("parseSenderIdentity", () => {
  it("reads a \"Name <address>\" form and a bare address", () => {
    expect(parseSenderIdentity("Tellovo <no-reply@tellovo.example>")).toEqual({
      name: "Tellovo",
      email: "no-reply@tellovo.example",
    });
    expect(parseSenderIdentity("no-reply@tellovo.example")).toEqual({
      name: "Tellovo",
      email: "no-reply@tellovo.example",
    });
  });

  it("returns null when nothing is usable", () => {
    expect(parseSenderIdentity(undefined)).toBeNull();
    expect(parseSenderIdentity("not an address")).toBeNull();
  });
});

describe("getEmailSender", () => {
  it("falls back to console mode without a Brevo key, like missing Stripe or GitHub", () => {
    expect(getEmailSender({})).toBe(consoleSender);
  });

  it("picks Brevo as soon as a key is present, without explicit EMAIL_PROVIDER", () => {
    expect(getEmailSender({ BREVO_API_KEY: "xkeysib-test" })).not.toBe(consoleSender);
  });

  it("flatly rejects EMAIL_PROVIDER=brevo without a key rather than sending to the logs", () => {
    expect(() => getEmailSender({ EMAIL_PROVIDER: "brevo" })).toThrow(/BREVO_API_KEY/);
  });

  it("rejects an unknown provider", () => {
    expect(() => getEmailSender({ EMAIL_PROVIDER: "sendgrid" })).toThrow(/Unknown/);
  });

  it("in production, never silently falls back to console — a key or an explicit choice is required", () => {
    expect(() => getEmailSender({ NODE_ENV: "production" })).toThrow(/production/);
    expect(getEmailSender({ NODE_ENV: "production", EMAIL_PROVIDER: "console" })).toBe(consoleSender);
    expect(getEmailSender({ NODE_ENV: "production", BREVO_API_KEY: "xkeysib-test" })).not.toBe(consoleSender);
  });
});

describe("createBrevoSender", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the body expected by the Brevo transactional API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ messageId: "1" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const sender = createBrevoSender("xkeysib-test", { name: "Tellovo", email: "no-reply@tellovo.example" });
    await sender.send({ to: "alix@example.com", subject: "Subject", html: "<p>Hello</p>", text: "Hello" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["api-key"]).toBe("xkeysib-test");
    expect(JSON.parse(init.body as string)).toEqual({
      sender: { name: "Tellovo", email: "no-reply@tellovo.example" },
      to: [{ email: "alix@example.com" }],
      subject: "Subject",
      htmlContent: "<p>Hello</p>",
      textContent: "Hello",
    });
  });

  it("throws a readable error when Brevo refuses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "unauthorized", message: "Key not found" }), { status: 401 }))
    );
    const sender = createBrevoSender("wrong", { name: "Tellovo", email: "no-reply@tellovo.example" });
    await expect(sender.send({ to: "a@b.c", subject: "s", html: "h", text: "t" })).rejects.toThrow(/HTTP 401/);
  });
});

describe("templates", () => {
  it("the sign-in link is in the text and in the HTML, escaped", () => {
    const url = "https://app.example/connexion/lien?token=abc&x=1";
    const email = loginLinkEmail({ loginUrl: url, expiresInHours: 24, fresh: false });
    expect(email.text).toContain(url);
    expect(email.html).toContain("token=abc&amp;x=1");
    expect(email.text).toContain("24 hours");
  });

  it("the deletion email contains no personal data", () => {
    const email = accountDeletedEmail();
    expect(email.text).not.toMatch(/@/);
    expect(email.subject).toMatch(/deleted/);
  });
});

describe("emails of the /start flow", () => {
  it("firstPostEmail carries the post in full in both versions, and the sign-in link", () => {
    const mail = firstPostEmail({ productName: "RelayKit", postText: "Line one\nLine <two>", loginUrl: "https://x.test/connexion/lien?token=abc", expiresInHours: 24 });
    expect(mail.text).toContain("Line one\nLine <two>");
    expect(mail.text).toContain("https://x.test/connexion/lien?token=abc");
    expect(mail.html).toContain("Line one\nLine &lt;two&gt;");
    expect(mail.html).toContain('href="https://x.test/connexion/lien?token=abc"');
    expect(mail.html.endsWith("</div></body></html>")).toBe(true);
  });

  it("loginLinkEmail says whether the week is ready", () => {
    expect(loginLinkEmail({ loginUrl: "https://x.test/l", expiresInHours: 24, fresh: true }).subject).toMatch(/first week/);
    expect(loginLinkEmail({ loginUrl: "https://x.test/l", expiresInHours: 24, fresh: false }).subject).toMatch(/Sign in/);
  });
});

describe("consoleSender in production", () => {
  const message = { to: "a@b.c", subject: "s", html: "h", text: "Open: https://app.test/connexion/lien?token=abc123 — bye" };

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("logs neither the body nor any link by default", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const info = vi.spyOn(logger, "info").mockImplementation(() => undefined);
    await consoleSender.send(message);
    expect(JSON.stringify(info.mock.calls)).not.toContain("abc123");
  });
});
