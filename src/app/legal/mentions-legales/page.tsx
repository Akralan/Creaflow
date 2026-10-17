import LegalPage, { sectionTitleStyle } from "@/components/LegalPage";
import { PUBLISHER, SERVICE_NAME } from "@/lib/legal/publisher";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Legal Notice",
  description: "Publisher, hosting and contact details of the Tellovo service.",
  alternates: { canonical: "/legal/mentions-legales" },
};

// Mandatory in France for any publicly accessible website (LCEN, art. 6-III). All variable content
// comes from src/lib/legal/publisher.ts — nothing to change here once the entity is set up.
export default function MentionsLegalesPage() {
  return (
    <LegalPage title="Legal Notice">
      <h2 style={sectionTitleStyle}>Site publisher</h2>
      <p>
        {PUBLISHER.name}
        <br />
        {PUBLISHER.legalForm}
        <br />
        {PUBLISHER.address}
        <br />
        SIRET: {PUBLISHER.siret}
        <br />
        VAT: {PUBLISHER.vat}
        <br />
        Contact email: {PUBLISHER.contactEmail}
      </p>

      <h2 style={sectionTitleStyle}>Publication director</h2>
      <p>{PUBLISHER.publicationDirector}</p>

      <h2 style={sectionTitleStyle}>Hosting</h2>
      <p>
        Application: {PUBLISHER.appHost.name}, {PUBLISHER.appHost.address} — {PUBLISHER.appHost.contact}
        <br />
        Database: {PUBLISHER.dbHost.name}, {PUBLISHER.dbHost.address} — {PUBLISHER.dbHost.contact}
      </p>

      <h2 style={sectionTitleStyle}>Intellectual property</h2>
      <p>
        The overall structure, texts, graphics, logos and elements making up {SERVICE_NAME} are, unless
        otherwise stated, the property of the publisher or its partners. Any reproduction,
        representation or distribution, in whole or in part, without authorization is prohibited.
        Content created by users with the service remains the property of its authors (see the terms
        and conditions).
      </p>

      <h2 style={sectionTitleStyle}>Personal data</h2>
      <p>
        The processing of personal data is described in the privacy policy. To exercise your rights:
        {PUBLISHER.contactEmail}.
      </p>

      <h2 style={sectionTitleStyle}>Contact</h2>
      <p>For any question about the site or the service: {PUBLISHER.contactEmail}.</p>
    </LegalPage>
  );
}
