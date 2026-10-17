/**
 * Publisher identity of the service: the only place to fill in so that the legal notice, the
 * terms of use and sale, the privacy policy and the footer are complete (docs/SPEC_LEGAL_EMAIL_RGPD.md
 * §2.1). These are not secrets: they live in the code, not in `.env`.
 *
 * Convention: a value in [square brackets] is a placeholder. As long as one remains, the legal
 * pages automatically display a "document being finalized" banner (isPublisherComplete) —
 * there is nothing else to remove once the entity is set up.
 */

export interface HostingProvider {
  name: string;
  address: string;
  contact: string;
}

export interface PublisherIdentity {
  /** Name of the individual or company name. */
  name: string;
  /** "Sole proprietor", "SAS with share capital of … €", etc. */
  legalForm: string;
  address: string;
  siret: string;
  /** EU VAT number, or VAT exemption notice (art. 293 B of the French General Tax Code). */
  vat: string;
  contactEmail: string;
  publicationDirector: string;
  /** Host of the application (Next.js server). */
  appHost: HostingProvider;
  /** Host of the database, if different from the application host. */
  dbHost: HostingProvider;
  /** Consumer mediator (mandatory for a business selling to consumers). */
  consumerMediator: { name: string; url: string };
}

export const PUBLISHER: PublisherIdentity = {
  name: "[Publisher name]",
  legalForm: "[Legal status]",
  address: "[Postal address]",
  siret: "[SIRET]",
  vat: "[VAT number or \"VAT not applicable, art. 293 B of the French General Tax Code\"]",
  contactEmail: "[contact email]",
  publicationDirector: "[Publication director]",
  appHost: {
    name: "[Application host]",
    address: "[Host address]",
    contact: "[Host contact]",
  },
  dbHost: {
    name: "[Database host]",
    address: "[Host address]",
    contact: "[Host contact]",
  },
  consumerMediator: {
    name: "[Consumer mediator]",
    url: "[Mediator URL]",
  },
};

/** Service name as it appears in documents and emails. */
export const SERVICE_NAME = "Tellovo";

/** True for a value still to be filled in: empty, or wrapped in square brackets. */
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

/** Fields still holding a placeholder — empty when the identity is complete. */
export function missingPublisherFields(identity: PublisherIdentity = PUBLISHER): string[] {
  return flatten(identity)
    .filter(([, value]) => isPlaceholder(value))
    .map(([key]) => key);
}

export function isPublisherComplete(identity: PublisherIdentity = PUBLISHER): boolean {
  return missingPublisherFields(identity).length === 0;
}

/**
 * Contact email usable in a `mailto:` link — null while it is a placeholder, so that the footer
 * does not display a broken link.
 */
export function getContactEmail(identity: PublisherIdentity = PUBLISHER): string | null {
  return isPlaceholder(identity.contactEmail) ? null : identity.contactEmail;
}
