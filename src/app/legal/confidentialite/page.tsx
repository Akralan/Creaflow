import LegalPage, { sectionTitleStyle } from "@/components/LegalPage";
import { color } from "@/lib/design/tokens";

const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 14, margin: "12px 0 20px" };
const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  borderBottom: `1px solid ${color.border}`,
  color: color.textMuted,
  fontWeight: 600,
};
const tdStyle: React.CSSProperties = { padding: "8px 10px", borderBottom: `1px solid ${color.divider}`, verticalAlign: "top" };

// ⚠️ Brouillon à faire relire par un professionnel du droit (RGPD) avant mise en ligne réelle.
// Reflète l'architecture réelle du produit au moment de la rédaction (docs/TECH.md) — à tenir à
// jour si de nouveaux sous-traitants ou traitements sont ajoutés (ex. analytics, nouveau provider LLM).
export default function ConfidentialitePage() {
  return (
    <LegalPage title="Politique de confidentialité" updatedAt="16 août 2026">
      <p>
        <strong>⚠️ Brouillon</strong> — ce document doit être relu par un professionnel du droit (RGPD)
        avant toute mise en ligne publique.
      </p>
      <p>
        Cette politique décrit les données personnelles traitées par CreaFlow, édité par [nom de
        l&apos;éditeur — voir mentions légales], responsable de traitement au sens du Règlement Général sur
        la Protection des Données (RGPD).
      </p>

      <h2 style={sectionTitleStyle}>1. Données collectées</h2>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Donnée</th>
            <th style={thStyle}>Quand</th>
            <th style={thStyle}>Finalité</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={tdStyle}>Email, mot de passe (haché, jamais stocké en clair)</td>
            <td style={tdStyle}>Création de compte</td>
            <td style={tdStyle}>Authentification</td>
          </tr>
          <tr>
            <td style={tdStyle}>Profil créateur (nom de marque, activité, ton, valeurs, matériel)</td>
            <td style={tdStyle}>Onboarding, saisie manuelle</td>
            <td style={tdStyle}>Personnaliser les contenus générés</td>
          </tr>
          <tr>
            <td style={tdStyle}>Catalogue produits, catégories/angles/séries éditoriales, scripts générés, calendrier</td>
            <td style={tdStyle}>Usage du service</td>
            <td style={tdStyle}>Fonctionnement du service</td>
          </tr>
          <tr>
            <td style={tdStyle}>Jetons d&apos;accès OAuth (réseaux sociaux, Google Drive)</td>
            <td style={tdStyle}>Connexion volontaire d&apos;un compte tiers</td>
            <td style={tdStyle}>Récupération de posts/métriques, import d&apos;images — révocable à tout moment</td>
          </tr>
          <tr>
            <td style={tdStyle}>Images importées ou générées, description IA associée</td>
            <td style={tdStyle}>Usage de la bibliothèque de ressources visuelles</td>
            <td style={tdStyle}>Génération de visuels de marque</td>
          </tr>
          <tr>
            <td style={tdStyle}>Données de facturation (plan, statut d&apos;abonnement) — jamais les coordonnées bancaires complètes</td>
            <td style={tdStyle}>Souscription à un abonnement payant</td>
            <td style={tdStyle}>Facturation, gestion de l&apos;abonnement</td>
          </tr>
          <tr>
            <td style={tdStyle}>Adresse IP</td>
            <td style={tdStyle}>Chaque requête</td>
            <td style={tdStyle}>Sécurité (limitation de débit anti-abus), lutte contre la fraude</td>
          </tr>
        </tbody>
      </table>

      <h2 style={sectionTitleStyle}>2. Base légale des traitements</h2>
      <p>
        Le traitement des données nécessaires au fonctionnement du compte et du service (authentification,
        génération de contenu, facturation) repose sur l&apos;exécution du contrat qui vous lie à CreaFlow
        (art. 6.1.b RGPD). La connexion de comptes tiers (réseaux sociaux, Google Drive) repose sur votre
        consentement explicite, donné au moment de la connexion et révocable à tout moment. Les mesures de
        sécurité (limitation de débit, journalisation technique) reposent sur l&apos;intérêt légitime de
        l&apos;éditeur à assurer la disponibilité et la sécurité du service.
      </p>

      <h2 style={sectionTitleStyle}>3. Destinataires des données — sous-traitants</h2>
      <p>Certaines données sont transmises à des prestataires techniques, dans la stricte mesure nécessaire au fonctionnement du service :</p>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Prestataire</th>
            <th style={thStyle}>Rôle</th>
            <th style={thStyle}>Localisation</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={tdStyle}>Google (Gemini API), Anthropic, Groq</td>
            <td style={tdStyle}>Génération de texte/images par IA (le contenu de vos prompts et données de profil pertinentes leur sont transmis pour générer une réponse)</td>
            <td style={tdStyle}>États-Unis</td>
          </tr>
          <tr>
            <td style={tdStyle}>Cloudflare (stockage R2)</td>
            <td style={tdStyle}>Stockage des images (vignettes, visuels générés)</td>
            <td style={tdStyle}>Réseau mondial Cloudflare</td>
          </tr>
          <tr>
            <td style={tdStyle}>Stripe</td>
            <td style={tdStyle}>Traitement des paiements et de la facturation</td>
            <td style={tdStyle}>États-Unis / Irlande</td>
          </tr>
          <tr>
            <td style={tdStyle}>TikTok, Meta (Instagram), LinkedIn, Google (YouTube), X</td>
            <td style={tdStyle}>Récupération de vos posts et métriques — uniquement si vous connectez le compte concerné</td>
            <td style={tdStyle}>Variable selon la plateforme</td>
          </tr>
          <tr>
            <td style={tdStyle}>[Hébergeur de la base de données]</td>
            <td style={tdStyle}>Hébergement de l&apos;ensemble des données du service</td>
            <td style={tdStyle}>[à préciser une fois l&apos;infrastructure de production choisie]</td>
          </tr>
        </tbody>
      </table>
      <p>
        Ces prestataires n&apos;utilisent vos données que pour exécuter la prestation demandée par CreaFlow, et
        non à leurs propres fins commerciales. Aucune donnée n&apos;est vendue à des tiers.
      </p>

      <h2 style={sectionTitleStyle}>4. Transferts hors Union européenne</h2>
      <p>
        Plusieurs prestataires listés ci-dessus sont situés hors de l&apos;Union européenne, notamment aux
        États-Unis. Ces transferts s&apos;appuient sur les garanties reconnues par le RGPD applicables à
        chaque prestataire (clauses contractuelles types, ou adhésion au cadre de protection des données
        UE-États-Unis (Data Privacy Framework) selon le prestataire).
      </p>

      <h2 style={sectionTitleStyle}>5. Durée de conservation</h2>
      <p>
        Vos données sont conservées tant que votre compte est actif. En cas de suppression de compte, vos
        données personnelles sont supprimées dans un délai raisonnable, sous réserve des données que la loi
        nous impose de conserver plus longtemps (ex. données de facturation, obligations comptables).
      </p>
      <p>
        <em>
          Note transitoire : la suppression de compte en libre-service n&apos;est pas encore disponible dans
          l&apos;application au moment de la rédaction — en attendant, toute demande de suppression envoyée à
          [email de contact] sera traitée manuellement dans le délai légal d&apos;un mois.
        </em>
      </p>

      <h2 style={sectionTitleStyle}>6. Cookies</h2>
      <p>
        CreaFlow utilise un unique cookie strictement nécessaire au fonctionnement du service : un cookie
        de session (httpOnly, sécurisé) permettant de vous maintenir connecté. Ce cookie ne sert à aucun
        suivi publicitaire ni à aucune mesure d&apos;audience, et n&apos;est donc soumis à aucun consentement
        préalable au titre de la réglementation cookies. Si un outil de mesure d&apos;audience ou publicitaire
        venait à être ajouté, cette politique serait mise à jour et un bandeau de consentement approprié
        serait ajouté avant toute activation.
      </p>

      <h2 style={sectionTitleStyle}>7. Vos droits</h2>
      <p>
        Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de
        limitation, de portabilité et d&apos;opposition sur vos données personnelles. Vous pouvez exercer ces
        droits en écrivant à [email de contact]. Vous disposez également du droit d&apos;introduire une
        réclamation auprès de la Commission Nationale de l&apos;Informatique et des Libertés (CNIL,
        www.cnil.fr).
      </p>

      <h2 style={sectionTitleStyle}>8. Sécurité</h2>
      <p>
        Les mots de passe sont hachés (jamais stockés en clair), les échanges avec le service sont chiffrés
        (HTTPS), et l&apos;accès aux données est limité par utilisateur. Des mesures de limitation de débit
        protègent le service contre les tentatives d&apos;accès frauduleuses.
      </p>

      <h2 style={sectionTitleStyle}>9. Mineurs</h2>
      <p>CreaFlow n&apos;est pas destiné aux personnes de moins de 16 ans.</p>

      <h2 style={sectionTitleStyle}>Contact</h2>
      <p>Pour toute question relative à cette politique ou à vos données personnelles : [email de contact].</p>
    </LegalPage>
  );
}
