/**
 * Identité de l'éditeur du service — le seul endroit à remplir pour que les mentions légales, les
 * CGU/CGV, la politique de confidentialité et le footer soient complets (docs/SPEC_LEGAL_EMAIL_RGPD.md
 * §2.1). Ce ne sont pas des secrets : ils vivent dans le code, pas dans `.env`.
 *
 * Convention : une valeur entre [crochets] est un placeholder. Tant qu'il en reste un, les pages
 * légales affichent d'elles-mêmes une bannière « document en cours de finalisation »
 * (isPublisherComplete) — il n'y a rien d'autre à retirer le jour où l'entité est arrêtée.
 */

export interface HostingProvider {
  name: string;
  address: string;
  contact: string;
}

export interface PublisherIdentity {
  /** Nom de la personne physique ou raison sociale. */
  name: string;
  /** « Entrepreneur individuel », « SAS au capital de … € », etc. */
  legalForm: string;
  address: string;
  siret: string;
  /** Numéro de TVA intracommunautaire, ou mention de franchise en base (art. 293 B du CGI). */
  vat: string;
  contactEmail: string;
  publicationDirector: string;
  /** Hébergeur de l'application (serveur Next.js). */
  appHost: HostingProvider;
  /** Hébergeur de la base de données, s'il diffère de l'application. */
  dbHost: HostingProvider;
  /** Médiateur de la consommation (obligatoire pour un professionnel vendant à des consommateurs). */
  consumerMediator: { name: string; url: string };
}

export const PUBLISHER: PublisherIdentity = {
  name: "[Nom de l'éditeur]",
  legalForm: "[Statut juridique]",
  address: "[Adresse postale]",
  siret: "[SIRET]",
  vat: "[Numéro de TVA ou « TVA non applicable, art. 293 B du CGI »]",
  contactEmail: "[email de contact]",
  publicationDirector: "[Directeur de la publication]",
  appHost: {
    name: "[Hébergeur de l'application]",
    address: "[Adresse de l'hébergeur]",
    contact: "[Contact de l'hébergeur]",
  },
  dbHost: {
    name: "[Hébergeur de la base de données]",
    address: "[Adresse de l'hébergeur]",
    contact: "[Contact de l'hébergeur]",
  },
  consumerMediator: {
    name: "[Médiateur de la consommation]",
    url: "[URL du médiateur]",
  },
};

/** Nom du service tel qu'il apparaît dans les documents et les emails. */
export const SERVICE_NAME = "CreaFlow";

/** Vrai pour une valeur encore à remplir : vide, ou entourée de crochets. */
export function isPlaceholder(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === "" || (trimmed.startsWith("[") && trimmed.endsWith("]"));
}

function flatten(identity: PublisherIdentity): Array<[string, string]> {
  return [
    ["name", identity.name],
    ["legalForm", identity.legalForm],
    ["address", identity.address],
    ["siret", identity.siret],
    ["vat", identity.vat],
    ["contactEmail", identity.contactEmail],
    ["publicationDirector", identity.publicationDirector],
    ["appHost.name", identity.appHost.name],
    ["appHost.address", identity.appHost.address],
    ["appHost.contact", identity.appHost.contact],
    ["dbHost.name", identity.dbHost.name],
    ["dbHost.address", identity.dbHost.address],
    ["dbHost.contact", identity.dbHost.contact],
    ["consumerMediator.name", identity.consumerMediator.name],
    ["consumerMediator.url", identity.consumerMediator.url],
  ];
}

/** Champs encore en placeholder — vide quand l'identité est complète. */
export function missingPublisherFields(identity: PublisherIdentity = PUBLISHER): string[] {
  return flatten(identity)
    .filter(([, value]) => isPlaceholder(value))
    .map(([key]) => key);
}

export function isPublisherComplete(identity: PublisherIdentity = PUBLISHER): boolean {
  return missingPublisherFields(identity).length === 0;
}

/**
 * Email de contact utilisable dans un lien `mailto:` — null tant qu'il est en placeholder, pour
 * que le footer n'affiche pas un lien cassé.
 */
export function getContactEmail(identity: PublisherIdentity = PUBLISHER): string | null {
  return isPlaceholder(identity.contactEmail) ? null : identity.contactEmail;
}
