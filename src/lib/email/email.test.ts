import { afterEach, describe, expect, it, vi } from "vitest";
import { createBrevoSender } from "./brevo";
import { getEmailSender, parseSenderIdentity } from "./index";
import { consoleSender } from "./console";
import { accountDeletedEmail, passwordChangedEmail, passwordResetEmail } from "./templates";

describe("parseSenderIdentity", () => {
  it("lit « Nom <adresse> » et une adresse nue", () => {
    expect(parseSenderIdentity("CreaFlow <no-reply@creaflow.example>")).toEqual({
      name: "CreaFlow",
      email: "no-reply@creaflow.example",
    });
    expect(parseSenderIdentity("no-reply@creaflow.example")).toEqual({
      name: "CreaFlow",
      email: "no-reply@creaflow.example",
    });
  });

  it("renvoie null quand il n'y a rien d'exploitable", () => {
    expect(parseSenderIdentity(undefined)).toBeNull();
    expect(parseSenderIdentity("pas une adresse")).toBeNull();
  });
});

describe("getEmailSender", () => {
  it("retombe sur le mode console sans clé Brevo, comme Stripe ou GitHub absents", () => {
    expect(getEmailSender({})).toBe(consoleSender);
  });

  it("choisit Brevo dès qu'une clé est présente, sans EMAIL_PROVIDER explicite", () => {
    expect(getEmailSender({ BREVO_API_KEY: "xkeysib-test" })).not.toBe(consoleSender);
  });

  it("refuse franchement EMAIL_PROVIDER=brevo sans clé plutôt que d'envoyer dans les logs", () => {
    expect(() => getEmailSender({ EMAIL_PROVIDER: "brevo" })).toThrow(/BREVO_API_KEY/);
  });

  it("refuse un provider inconnu", () => {
    expect(() => getEmailSender({ EMAIL_PROVIDER: "sendgrid" })).toThrow(/inconnu/);
  });

  it("en production, ne retombe jamais silencieusement sur la console — il faut une clé ou un choix explicite", () => {
    expect(() => getEmailSender({ NODE_ENV: "production" })).toThrow(/production/);
    expect(getEmailSender({ NODE_ENV: "production", EMAIL_PROVIDER: "console" })).toBe(consoleSender);
    expect(getEmailSender({ NODE_ENV: "production", BREVO_API_KEY: "xkeysib-test" })).not.toBe(consoleSender);
  });
});

describe("createBrevoSender", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("envoie le corps attendu par l'API transactionnelle Brevo", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ messageId: "1" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const sender = createBrevoSender("xkeysib-test", { name: "CreaFlow", email: "no-reply@creaflow.example" });
    await sender.send({ to: "alix@example.com", subject: "Sujet", html: "<p>Bonjour</p>", text: "Bonjour" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["api-key"]).toBe("xkeysib-test");
    expect(JSON.parse(init.body as string)).toEqual({
      sender: { name: "CreaFlow", email: "no-reply@creaflow.example" },
      to: [{ email: "alix@example.com" }],
      subject: "Sujet",
      htmlContent: "<p>Bonjour</p>",
      textContent: "Bonjour",
    });
  });

  it("lève une erreur lisible quand Brevo refuse", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "unauthorized", message: "Key not found" }), { status: 401 }))
    );
    const sender = createBrevoSender("mauvaise", { name: "CreaFlow", email: "no-reply@creaflow.example" });
    await expect(sender.send({ to: "a@b.c", subject: "s", html: "h", text: "t" })).rejects.toThrow(/HTTP 401/);
  });
});

describe("templates", () => {
  it("le lien de réinitialisation est dans le texte et dans le HTML, échappé", () => {
    const url = "https://app.example/reinitialiser-mot-de-passe?token=abc&x=1";
    const email = passwordResetEmail({ resetUrl: url, expiresInMinutes: 60 });
    expect(email.text).toContain(url);
    expect(email.html).toContain("token=abc&amp;x=1");
    expect(email.text).toContain("60 minutes");
  });

  it("l'avis de changement cite l'adresse de contact seulement quand elle existe", () => {
    expect(passwordChangedEmail({ contactEmail: "contact@example.com" }).text).toContain("contact@example.com");
    expect(passwordChangedEmail({ contactEmail: null }).text).not.toContain("écrivez-nous");
  });

  it("l'email de suppression ne contient aucune donnée personnelle", () => {
    const email = accountDeletedEmail();
    expect(email.text).not.toMatch(/@/);
    expect(email.subject).toMatch(/supprimé/);
  });
});
