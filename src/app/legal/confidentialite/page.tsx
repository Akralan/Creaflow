import Link from "next/link";
import LegalPage, { sectionTitleStyle } from "@/components/LegalPage";
import { color } from "@/lib/design/tokens";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Quelles données CreaFlow traite, pourquoi, avec quels sous-traitants, et vos droits.",
  alternates: { canonical: "/legal/confidentialite" },
};
import { PUBLISHER, SERVICE_NAME } from "@/lib/legal/publisher";

const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 14, margin: "12px 0 20px" };
const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  borderBottom: `1px solid ${color.border}`,
  color: color.textMuted,
  fontWeight: 600,
};
const tdStyle: React.CSSProperties = { padding: "8px 10px", borderBottom: `1px solid ${color.divider}`, verticalAlign: "top" };

// Reflète l'architecture réelle du produit (docs/TECH.md, docs/SPEC_LEGAL_EMAIL_RGPD.md §2.3) : un
// nouveau sous-traitant (analytics, nouveau provider LLM, Session Replay Sentry…) doit passer par
// ici avant d'être activé. Rédaction interne à faire relire par un professionnel du droit (RGPD)
// avant l'ouverture commerciale.
export default function ConfidentialitePage() {
  return (
    <LegalPage title="Politique de confidentialité">
      <p>
        Cette politique décrit les données personnelles traitées par {SERVICE_NAME}, édité par{" "}
        {PUBLISHER.name} (voir les <Link href="/legal/mentions-legales">mentions légales</Link>),
        responsable de traitement au sens du Règlement Général sur la Protection des Données (RGPD).
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
            <td style={tdStyle}>Authentification, emails de service</td>
          </tr>
          <tr>
            <td style={tdStyle}>Identité fournie par GitHub, Notion ou Linear (identifiant, nom, avatar, email)</td>
            <td style={tdStyle}>Inscription ou connexion via l&apos;un de ces fournisseurs</td>
            <td style={tdStyle}>Authentification, pré-remplissage du profil</td>
          </tr>
          <tr>
            <td style={tdStyle}>Profil de marque (nom, activité, ton, valeurs, audience, matériel)</td>
            <td style={tdStyle}>Onboarding, saisie manuelle</td>
            <td style={tdStyle}>Personnaliser les contenus générés</td>
          </tr>
          <tr>
            <td style={tdStyle}>
              Matière écrite (documents importés, réponses à l&apos;interview, contenu de vos dépôts, pages
              et projets connectés), sujets, séries, scripts générés et corrigés, calendrier, messages
              échangés avec l&apos;assistant
            </td>
            <td style={tdStyle}>Usage du service</td>
            <td style={tdStyle}>Fonctionnement du service, apprentissage de votre style d&apos;écriture (propre à votre compte)</td>
          </tr>
          <tr>
            <td style={tdStyle}>Jetons d&apos;accès OAuth (réseaux sociaux, Google Drive, GitHub, Notion, Linear)</td>
            <td style={tdStyle}>Connexion volontaire d&apos;un compte tiers</td>
            <td style={tdStyle}>Lecture de vos posts, métriques, documents et dépôts — révocable à tout moment</td>
          </tr>
          <tr>
            <td style={tdStyle}>Photos importées, leur version détourée, description IA associée, maquettes de posts visuels</td>
            <td style={tdStyle}>Usage de la bibliothèque de ressources visuelles</td>
            <td style={tdStyle}>Composition de vos posts visuels</td>
          </tr>
          <tr>
            <td style={tdStyle}>Données de facturation (plan, statut d&apos;abonnement, identifiant client Stripe) — jamais les coordonnées bancaires</td>
            <td style={tdStyle}>Souscription à un abonnement payant</td>
            <td style={tdStyle}>Facturation, gestion de l&apos;abonnement</td>
          </tr>
          <tr>
            <td style={tdStyle}>Adresse IP, navigateur, identifiant de compte</td>
            <td style={tdStyle}>Chaque requête ; en cas d&apos;erreur technique</td>
            <td style={tdStyle}>Sécurité (limitation de débit), diagnostic des erreurs</td>
          </tr>
        </tbody>
      </table>

      <h2 style={sectionTitleStyle}>2. Base légale des traitements</h2>
      <p>
        Le traitement des données nécessaires au fonctionnement du compte et du service (authentification,
        génération de contenu, facturation, emails de service) repose sur l&apos;exécution du contrat qui
        vous lie à l&apos;éditeur (art. 6.1.b RGPD). La connexion de comptes tiers repose sur votre
        consentement, donné au moment de la connexion et révocable à tout moment. Les mesures de
        sécurité et le diagnostic des erreurs reposent sur l&apos;intérêt légitime de l&apos;éditeur à assurer
        la disponibilité et la sécurité du service. La conservation des factures repose sur une
        obligation légale.
      </p>

      <h2 style={sectionTitleStyle}>3. Destinataires des données — sous-traitants</h2>
      <p>
        Certaines données sont transmises à des prestataires techniques, dans la stricte mesure
        nécessaire au fonctionnement du service :
      </p>
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
            <td style={tdStyle}>OpenAI</td>
            <td style={tdStyle}>
              Génération de texte par IA, assistant éditorial, indexation de vos images (votre matière,
              votre profil et vos consignes leur sont transmis pour produire une réponse)
            </td>
            <td style={tdStyle}>États-Unis</td>
          </tr>
          <tr>
            <td style={tdStyle}>Google (Gemini API)</td>
            <td style={tdStyle}>Description automatique de vos photos (vos images lui sont transmises pour être décrites)</td>
            <td style={tdStyle}>États-Unis</td>
          </tr>
          <tr>
            <td style={tdStyle}>Photoroom</td>
            <td style={tdStyle}>
              Détourage d&apos;une photo (suppression du fond) — uniquement quand vous le demandez pour une
              photo donnée ; la photo lui est transmise, le résultat est conservé par nos soins
            </td>
            <td style={tdStyle}>France</td>
          </tr>
          <tr>
            <td style={tdStyle}>Cloudflare (stockage R2)</td>
            <td style={tdStyle}>Stockage des images (originaux importés, vignettes, détourages)</td>
            <td style={tdStyle}>Réseau mondial Cloudflare</td>
          </tr>
          <tr>
            <td style={tdStyle}>Stripe</td>
            <td style={tdStyle}>Traitement des paiements et de la facturation</td>
            <td style={tdStyle}>États-Unis / Irlande</td>
          </tr>
          <tr>
            <td style={tdStyle}>Brevo</td>
            <td style={tdStyle}>Envoi des emails de service (réinitialisation de mot de passe, avis de sécurité)</td>
            <td style={tdStyle}>Union européenne (France)</td>
          </tr>
          <tr>
            <td style={tdStyle}>Sentry</td>
            <td style={tdStyle}>
              Remontée des erreurs techniques (adresse IP, navigateur, identifiant de compte, trace de
              l&apos;erreur — jamais le contenu de vos scripts ni vos mots de passe)
            </td>
            <td style={tdStyle}>États-Unis</td>
          </tr>
          <tr>
            <td style={tdStyle}>GitHub, Notion, Linear</td>
            <td style={tdStyle}>Identité et lecture de vos dépôts, pages et projets — uniquement si vous connectez le compte concerné</td>
            <td style={tdStyle}>États-Unis</td>
          </tr>
          <tr>
            <td style={tdStyle}>TikTok, Meta (Instagram), LinkedIn, Google (YouTube, Drive), X</td>
            <td style={tdStyle}>Lecture de vos posts, métriques et images — uniquement si vous connectez le compte concerné</td>
            <td style={tdStyle}>Variable selon la plateforme</td>
          </tr>
          <tr>
            <td style={tdStyle}>{PUBLISHER.appHost.name}</td>
            <td style={tdStyle}>Hébergement de l&apos;application</td>
            <td style={tdStyle}>{PUBLISHER.appHost.address}</td>
          </tr>
          <tr>
            <td style={tdStyle}>{PUBLISHER.dbHost.name}</td>
            <td style={tdStyle}>Hébergement de la base de données</td>
            <td style={tdStyle}>{PUBLISHER.dbHost.address}</td>
          </tr>
        </tbody>
      </table>
      <p>
        Ces prestataires n&apos;utilisent vos données que pour exécuter la prestation demandée par
        l&apos;éditeur, et non à leurs propres fins. Les prestataires d&apos;IA sont sollicités via leurs
        offres professionnelles, dont les conditions excluent l&apos;utilisation de vos données pour
        l&apos;entraînement de leurs modèles. Aucune donnée n&apos;est vendue à des tiers.
      </p>

      <h2 style={sectionTitleStyle}>4. Transferts hors Union européenne</h2>
      <p>
        Plusieurs prestataires listés ci-dessus sont situés aux États-Unis. Ces transferts s&apos;appuient
        sur les garanties reconnues par le RGPD applicables à chaque prestataire : clauses contractuelles
        types de la Commission européenne, ou certification au cadre de protection des données
        UE-États-Unis (Data Privacy Framework).
      </p>

      <h2 style={sectionTitleStyle}>5. Durée de conservation</h2>
      <p>
        Vos données sont conservées tant que votre compte est actif. Lorsque vous supprimez votre
        compte :
      </p>
      <ul>
        <li>
          vos données dans l&apos;application (profil, matière, scripts, calendrier, jetons d&apos;accès,
          images stockées) sont effacées <strong>immédiatement</strong> ;
        </li>
        <li>
          vos factures et votre identifiant client sont conservés par Stripe pendant la durée légale
          des obligations comptables (dix ans) ;
        </li>
        <li>
          les traces d&apos;erreurs techniques déjà remontées à Sentry sont purgées à l&apos;échéance de leur
          rétention (90 jours au plus) ;
        </li>
        <li>
          les sauvegardes de la base de données tenues par l&apos;hébergeur sont écrasées par rotation dans
          un délai maximal de trente jours.
        </li>
      </ul>
      <p>
        Les jetons de réinitialisation de mot de passe expirent au bout d&apos;une heure. Les compteurs de
        limitation de débit portent sur l&apos;adresse IP et sur une empreinte de l&apos;email (jamais
        l&apos;adresse en clair) ; ils sont purgés automatiquement dans les heures qui suivent leur
        création.
      </p>

      <h2 style={sectionTitleStyle}>6. Cookies</h2>
      <p>
        {SERVICE_NAME} utilise un unique cookie strictement nécessaire au fonctionnement du service : un
        cookie de session (httpOnly, sécurisé) qui vous maintient connecté pendant sept jours. Ce cookie
        ne sert à aucun suivi publicitaire ni à aucune mesure d&apos;audience, et n&apos;est donc soumis à
        aucun consentement préalable. Si un outil de mesure d&apos;audience ou publicitaire venait à être
        ajouté, cette politique serait mise à jour et un bandeau de consentement ajouté avant toute
        activation.
      </p>

      <h2 style={sectionTitleStyle}>7. Emails</h2>
      <p>
        {SERVICE_NAME} ne vous envoie que des emails de service : lien de réinitialisation de mot de
        passe, avis de modification de votre mot de passe, confirmation de suppression de compte,
        information sur une modification des conditions ou des prix. Aucune newsletter, aucune
        prospection, aucun suivi d&apos;ouverture.
      </p>

      <h2 style={sectionTitleStyle}>8. Vos droits</h2>
      <p>
        Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de
        limitation, de portabilité et d&apos;opposition sur vos données personnelles. Deux de ces droits
        s&apos;exercent directement depuis les paramètres de votre compte (onglet « Compte ») :
      </p>
      <ul>
        <li>
          <strong>Portabilité et accès</strong> : « Télécharger mes données » produit un fichier JSON
          contenant l&apos;ensemble de vos données (profil, matière, scripts, calendrier, connexions sans
          leurs jetons, abonnement) ; les images y sont référencées par leur adresse.
        </li>
        <li>
          <strong>Effacement</strong> : « Supprimer mon compte » efface immédiatement vos données, comme
          décrit à la section 5.
        </li>
      </ul>
      <p>
        Pour les autres droits, ou toute question, écrivez à {PUBLISHER.contactEmail} ; nous répondons
        dans un délai d&apos;un mois. Vous pouvez également introduire une réclamation auprès de la
        Commission Nationale de l&apos;Informatique et des Libertés (CNIL, www.cnil.fr).
      </p>

      <h2 style={sectionTitleStyle}>9. Sécurité</h2>
      <p>
        Les mots de passe sont hachés (jamais stockés en clair), les échanges avec le service sont
        chiffrés (HTTPS), et l&apos;accès aux données est limité à votre compte. Des mesures de limitation
        de débit protègent le service contre les tentatives d&apos;accès frauduleuses. Un changement de mot
        de passe ferme toutes les sessions ouvertes et vous est notifié par email.
      </p>

      <h2 style={sectionTitleStyle}>10. Mineurs</h2>
      <p>{SERVICE_NAME} n&apos;est pas destiné aux personnes de moins de 18 ans.</p>

      <h2 style={sectionTitleStyle}>Contact</h2>
      <p>
        Pour toute question relative à cette politique ou à vos données personnelles :{" "}
        {PUBLISHER.contactEmail}.
      </p>
    </LegalPage>
  );
}
