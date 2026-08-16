import Link from "next/link";
import LegalPage, { sectionTitleStyle } from "@/components/LegalPage";

// ⚠️ Brouillon à faire relire par un professionnel du droit avant mise en ligne réelle — en
// particulier les clauses de responsabilité, de résiliation et de droit applicable. Les champs
// entre [crochets] sont des placeholders (voir mentions-legales/page.tsx).
export default function CguPage() {
  return (
    <LegalPage title="Conditions Générales d'Utilisation" updatedAt="16 août 2026">
      <p>
        <strong>⚠️ Brouillon</strong> — ce document doit être relu par un professionnel du droit avant
        toute mise en ligne publique. Les présentes CGU régissent l&apos;utilisation du service CreaFlow,
        édité par [nom de l&apos;éditeur — voir <Link href="/legal/mentions-legales">mentions légales</Link>].
        En créant un compte, vous acceptez les présentes conditions.
      </p>

      <h2 style={sectionTitleStyle}>1. Objet du service</h2>
      <p>
        CreaFlow est un outil d&apos;assistance à la création de contenu pour les réseaux sociaux : génération
        de scripts assistée par IA, calendrier éditorial, connexion optionnelle à des comptes de réseaux
        sociaux pour le suivi de performance, et bibliothèque de ressources visuelles. CreaFlow ne publie
        aucun contenu à votre place sur vos réseaux sociaux — toute publication reste une action manuelle
        de votre part, sur les plateformes concernées.
      </p>

      <h2 style={sectionTitleStyle}>2. Création de compte</h2>
      <p>
        L&apos;accès au service nécessite un compte (email + mot de passe). Vous êtes responsable de la
        confidentialité de vos identifiants et de toute activité effectuée depuis votre compte. Vous vous
        engagez à fournir des informations exactes lors de la création du compte.
      </p>

      <h2 style={sectionTitleStyle}>3. Contenu généré par IA</h2>
      <p>
        Les scripts, suggestions et images produits par CreaFlow sont générés par des modèles d&apos;intelligence
        artificielle tiers. Ils constituent des propositions de départ, pas un contenu prêt à publier sans
        relecture : CreaFlow ne garantit ni l&apos;exactitude, ni la pertinence, ni la conformité (droit
        d&apos;auteur, réglementation publicitaire, image de marque) du contenu généré. Vous restez seul
        responsable du contenu que vous choisissez de publier sur vos réseaux sociaux, et devez le relire
        et l&apos;adapter avant toute publication.
      </p>
      <p>
        CreaFlow ne garantit aucun résultat en termes d&apos;audience, d&apos;engagement ou de conversion suite à
        la publication d&apos;un contenu généré via le service.
      </p>

      <h2 style={sectionTitleStyle}>4. Connexion de comptes tiers</h2>
      <p>
        La connexion de vos comptes de réseaux sociaux (TikTok, Instagram, LinkedIn, YouTube, X) ou de
        votre Google Drive est optionnelle et se fait via l&apos;autorisation OAuth officielle de chaque
        plateforme, avec les seules permissions nécessaires au fonctionnement des fonctionnalités
        concernées (récupération de posts et de métriques, import d&apos;images). Vous pouvez révoquer ces
        accès à tout moment depuis les paramètres de votre compte CreaFlow et/ou directement depuis les
        paramètres de sécurité de chaque plateforme tierce.
      </p>

      <h2 style={sectionTitleStyle}>5. Abonnement et facturation</h2>
      <p>
        CreaFlow propose un essai gratuit limité, puis des plans payants avec engagement mensuel, gérés via
        notre prestataire de paiement Stripe. Les paiements par carte sont traités directement par Stripe :
        CreaFlow n&apos;a jamais accès à vos coordonnées bancaires complètes. Vous pouvez gérer ou résilier
        votre abonnement à tout moment depuis l&apos;espace de facturation de votre compte ; la résiliation
        prend effet à la fin de la période déjà payée, sans remboursement au prorata sauf disposition légale
        contraire.
      </p>

      <h2 style={sectionTitleStyle}>6. Usage acceptable</h2>
      <p>
        Vous vous engagez à ne pas utiliser CreaFlow pour générer ou diffuser du contenu illégal,
        diffamatoire, trompeur, ou portant atteinte aux droits de tiers, et à ne pas utiliser le service
        d&apos;une manière qui violerait les conditions d&apos;utilisation des plateformes tierces connectées
        (réseaux sociaux, fournisseurs de modèles IA). Tout usage abusif (spam, tentative de contournement
        des limites techniques du service) peut entraîner la suspension du compte.
      </p>

      <h2 style={sectionTitleStyle}>7. Disponibilité du service</h2>
      <p>
        CreaFlow est fourni en l&apos;état, sans garantie de disponibilité continue. Le service peut évoluer,
        être temporairement interrompu pour maintenance, ou voir certaines fonctionnalités modifiées ou
        retirées, avec un effort raisonnable d&apos;information préalable des utilisateurs concernés.
      </p>

      <h2 style={sectionTitleStyle}>8. Résiliation</h2>
      <p>
        Vous pouvez cesser d&apos;utiliser le service et demander la suppression de votre compte à tout moment
        (voir la <Link href="/legal/confidentialite">politique de confidentialité</Link>). L&apos;éditeur se
        réserve le droit de suspendre ou résilier un compte en cas de violation des présentes CGU.
      </p>

      <h2 style={sectionTitleStyle}>9. Responsabilité</h2>
      <p>
        Dans la limite permise par la loi applicable, la responsabilité de l&apos;éditeur ne saurait excéder
        les sommes effectivement versées par l&apos;utilisateur au titre de son abonnement au cours des douze
        derniers mois. L&apos;éditeur ne saurait être tenu responsable des dommages indirects, ni des
        conséquences d&apos;un contenu généré par IA publié sans relecture préalable par l&apos;utilisateur.
      </p>

      <h2 style={sectionTitleStyle}>10. Droit applicable</h2>
      <p>
        Les présentes CGU sont soumises au droit français [à confirmer selon l&apos;immatriculation définitive
        de l&apos;entité éditrice]. Tout litige relève, à défaut de résolution amiable, des tribunaux compétents.
      </p>

      <h2 style={sectionTitleStyle}>Contact</h2>
      <p>Pour toute question relative aux présentes CGU : [email de contact].</p>
    </LegalPage>
  );
}
