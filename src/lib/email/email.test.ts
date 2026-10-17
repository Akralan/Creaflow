import { afterEach, describe, expect, it, vi } from "vitest";
import { createBrevoSender } from "./brevo";
import { getEmailSender, parseSenderIdentity } from "./index";
import { consoleSender } from "./console";
import { accountDeletedEmail, passwordChangedEmail, passwordResetEmail } from "./templates";

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
  it("the reset link is in the text and in the HTML, escaped", () => {
    const url = "https://app.example/reinitialiser-mot-de-passe?token=abc&x=1";
    const email = passwordResetEmail({ resetUrl: url, expiresInMinutes: 60 });
    expect(email.text).toContain(url);
    expect(email.html).toContain("token=abc&amp;x=1");
    expect(email.text).toContain("60 minutes");
  });

  it("the change notice mentions the contact address only when it exists", () => {
    expect(passwordChangedEmail({ contactEmail: "contact@example.com" }).text).toContain("contact@example.com");
    expect(passwordChangedEmail({ contactEmail: null }).text).not.toContain("write to us");
  });

  it("the deletion email contains no personal data", () => {
    const email = accountDeletedEmail();
    expect(email.text).not.toMatch(/@/);
    expect(email.subject).toMatch(/deleted/);
  });
});
