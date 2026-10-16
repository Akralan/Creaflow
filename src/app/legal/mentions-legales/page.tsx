import LegalPage, { sectionTitleStyle } from "@/components/LegalPage";
import { PUBLISHER, SERVICE_NAME } from "@/lib/legal/publisher";

// Obligatoire en France pour tout site accessible au public (LCEN, art. 6-III). Tout le contenu
// variable vient de src/lib/legal/publisher.ts — rien à modifier ici le jour où l'entité est arrêtée.
export default function MentionsLegalesPage() {
  return (
    <LegalPage title="Mentions légales">
      <h2 style={sectionTitleStyle}>Éditeur du site</h2>
      <p>
        {PUBLISHER.name}
        <br />
        {PUBLISHER.legalForm}
        <br />
        {PUBLISHER.address}
        <br />
        SIRET : {PUBLISHER.siret}
        <br />
        TVA : {PUBLISHER.vat}
        <br />
        Email de contact : {PUBLISHER.contactEmail}
      </p>

      <h2 style={sectionTitleStyle}>Directeur de la publication</h2>
      <p>{PUBLISHER.publicationDirector}</p>

      <h2 style={sectionTitleStyle}>Hébergement</h2>
      <p>
        Application : {PUBLISHER.appHost.name}, {PUBLISHER.appHost.address} — {PUBLISHER.appHost.contact}
        <br />
        Base de données : {PUBLISHER.dbHost.name}, {PUBLISHER.dbHost.address} — {PUBLISHER.dbHost.contact}
      </p>

      <h2 style={sectionTitleStyle}>Propriété intellectuelle</h2>
      <p>
        La structure générale, les textes, graphismes, logos et éléments composant {SERVICE_NAME} sont,
        sauf mention contraire, la propriété de l&apos;éditeur ou de ses partenaires. Toute reproduction,
        représentation ou diffusion, en tout ou partie, sans autorisation, est interdite. Les contenus
        créés par les utilisateurs à l&apos;aide du service restent la propriété de leurs auteurs (voir
        les conditions générales).
      </p>

      <h2 style={sectionTitleStyle}>Données personnelles</h2>
      <p>
        Le traitement des données personnelles est décrit dans la politique de confidentialité. Pour
        exercer vos droits : {PUBLISHER.contactEmail}.
      </p>

      <h2 style={sectionTitleStyle}>Contact</h2>
      <p>Pour toute question relative au site ou au service : {PUBLISHER.contactEmail}.</p>
    </LegalPage>
  );
}
