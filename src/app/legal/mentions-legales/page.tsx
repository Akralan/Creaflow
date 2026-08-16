import LegalPage, { sectionTitleStyle } from "@/components/LegalPage";

// ⚠️ Page à compléter avant toute mise en ligne réelle — les champs entre [crochets] sont des
// placeholders (aucune entité juridique n'est encore immatriculée au moment de la rédaction).
// Obligatoire en France pour tout site accessible au public (LCEN, art. 6-III).
export default function MentionsLegalesPage() {
  return (
    <LegalPage title="Mentions légales" updatedAt="16 août 2026">
      <p>
        <strong>⚠️ Document à finaliser</strong> — les informations entre crochets ci-dessous sont des
        placeholders à remplacer par les informations réelles de l&apos;éditeur avant toute mise en ligne
        publique du service.
      </p>

      <h2 style={sectionTitleStyle}>Éditeur du site</h2>
      <p>
        [Nom de l&apos;éditeur — personne physique ou raison sociale]
        <br />
        [Statut juridique — à définir une fois l&apos;entité immatriculée]
        <br />
        [Adresse postale]
        <br />
        [Numéro SIRET, si applicable]
        <br />
        Email de contact : [email de contact]
      </p>

      <h2 style={sectionTitleStyle}>Directeur de la publication</h2>
      <p>[Nom du directeur de la publication]</p>

      <h2 style={sectionTitleStyle}>Hébergement</h2>
      <p>
        [Nom de l&apos;hébergeur, adresse, contact] — à préciser une fois l&apos;infrastructure de production
        choisie (voir la feuille de route technique interne).
      </p>

      <h2 style={sectionTitleStyle}>Propriété intellectuelle</h2>
      <p>
        La structure générale, les textes, graphismes, logos et éléments composant CreaFlow sont, sauf
        mention contraire, la propriété de l&apos;éditeur ou de ses partenaires. Toute reproduction,
        représentation ou diffusion, en tout ou partie, sans autorisation, est interdite.
      </p>

      <h2 style={sectionTitleStyle}>Contact</h2>
      <p>Pour toute question relative au site ou au service : [email de contact].</p>
    </LegalPage>
  );
}
