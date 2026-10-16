import Link from "next/link";
import LegalPage, { sectionTitleStyle } from "@/components/LegalPage";
import { PUBLISHER, SERVICE_NAME } from "@/lib/legal/publisher";
import { FREE_TRIAL_MICRO_EDIT_LIMIT, FREE_TRIAL_SCRIPT_LIMIT, PLANS } from "@/lib/billing/plans";

// CGU et CGV réunies en un seul document (docs/SPEC_LEGAL_EMAIL_RGPD.md §2.2) : un seul lien, une
// seule case à cocher à l'inscription. Les quotas viennent de src/lib/billing/plans.ts pour ne
// jamais diverger du code ; les montants, eux, vivent côté Stripe et sur la page de tarifs, pas ici.
// Rédaction interne à faire relire par un professionnel du droit avant l'ouverture commerciale,
// en particulier les sections 9 (rétractation), 15 (responsabilité) et 16 (droit applicable).
export default function CguPage() {
  return (
    <LegalPage title="Conditions Générales d'Utilisation et de Vente">
      <p>
        Les présentes conditions régissent l&apos;utilisation du service {SERVICE_NAME} et la souscription
        de ses offres payantes. Le service est édité par {PUBLISHER.name} ({PUBLISHER.legalForm}),
        ci-après « l&apos;éditeur » — voir les{" "}
        <Link href="/legal/mentions-legales">mentions légales</Link>. En créant un compte, vous les
        acceptez dans leur intégralité.
      </p>

      <h2 style={sectionTitleStyle}>1. Objet du service</h2>
      <p>
        {SERVICE_NAME} est un outil d&apos;assistance à la création de contenu pour les réseaux sociaux. À
        partir de votre matière écrite (notes, documents, dépôts GitHub, pages Notion, projets Linear,
        réponses à une interview) et de votre profil de marque, il propose des séries de contenu, des
        scripts et des posts visuels générés par intelligence artificielle, un calendrier éditorial, un
        assistant éditorial, une bibliothèque de ressources visuelles et un suivi de performance.
      </p>
      <p>
        {SERVICE_NAME} ne publie aucun contenu à votre place sur vos réseaux sociaux : toute publication
        reste une action manuelle de votre part, sur les plateformes concernées.
      </p>

      <h2 style={sectionTitleStyle}>2. Création de compte</h2>
      <p>
        L&apos;accès au service nécessite un compte, créé avec une adresse email et un mot de passe, ou via
        un fournisseur d&apos;identité tiers (GitHub, Notion, Linear). Vous êtes responsable de la
        confidentialité de vos identifiants et de toute activité effectuée depuis votre compte. Vous
        vous engagez à fournir des informations exactes. Le service est réservé aux personnes majeures.
      </p>

      <h2 style={sectionTitleStyle}>3. Contenu généré par IA</h2>
      <p>
        Les scripts, suggestions, maquettes et images produits par {SERVICE_NAME} sont générés par des
        modèles d&apos;intelligence artificielle tiers. Ils constituent des propositions de départ, pas un
        contenu prêt à publier sans relecture : l&apos;éditeur ne garantit ni l&apos;exactitude, ni la
        pertinence, ni la conformité (droit d&apos;auteur, réglementation publicitaire, image de marque) du
        contenu généré. Vous restez seul responsable du contenu que vous choisissez de publier, et devez
        le relire et l&apos;adapter avant toute publication.
      </p>
      <p>
        L&apos;éditeur ne garantit aucun résultat en termes d&apos;audience, d&apos;engagement ou de conversion.
      </p>

      <h2 style={sectionTitleStyle}>4. Vos contenus et votre matière</h2>
      <p>
        Vous restez propriétaire de la matière que vous apportez au service et des contenus que vous y
        créez. Vous accordez à l&apos;éditeur une licence limitée, non exclusive, pour la seule durée de
        votre compte, aux seules fins de vous fournir le service (stockage, analyse, transmission aux
        modèles d&apos;IA pour générer vos contenus). L&apos;éditeur n&apos;utilise pas vos contenus pour
        entraîner des modèles d&apos;intelligence artificielle, et ne les cède à personne. Les prestataires
        d&apos;IA sont sollicités via leurs offres professionnelles, dont les conditions excluent
        l&apos;utilisation de vos données pour l&apos;entraînement de leurs modèles.
      </p>
      <p>
        Vous garantissez disposer des droits nécessaires sur la matière que vous apportez (textes,
        images, données issues de vos comptes connectés).
      </p>

      <h2 style={sectionTitleStyle}>5. Connexion de comptes tiers</h2>
      <p>
        La connexion de vos comptes (réseaux sociaux, Google Drive, GitHub, Notion, Linear) est
        optionnelle et passe par l&apos;autorisation officielle de chaque plateforme, avec les seules
        permissions nécessaires aux fonctionnalités concernées (lecture de vos posts et métriques,
        import d&apos;images, lecture de vos documents et dépôts publics). Vous pouvez retirer ces accès à
        tout moment depuis les paramètres de votre compte {SERVICE_NAME} et depuis les paramètres de
        sécurité de chaque plateforme. La suppression de votre compte efface les jetons d&apos;accès de
        notre côté ; la révocation chez la plateforme reste à faire par vous.
      </p>

      <h2 style={sectionTitleStyle}>6. Offres et essai gratuit</h2>
      <p>
        Le service propose un essai gratuit, sans carte bancaire, limité à {FREE_TRIAL_SCRIPT_LIMIT}{" "}
        générations de scripts et {FREE_TRIAL_MICRO_EDIT_LIMIT} micro-retouches, sans limite de durée.
        Au-delà, deux abonnements mensuels sont proposés :
      </p>
      <ul>
        <li>
          <strong>{PLANS.starter.name}</strong> : {PLANS.starter.scriptsPerMonth} générations et{" "}
          {PLANS.starter.microEditsPerMonth} micro-retouches par mois ;
        </li>
        <li>
          <strong>{PLANS.pro.name}</strong> : {PLANS.pro.scriptsPerMonth} générations et{" "}
          {PLANS.pro.microEditsPerMonth} micro-retouches par mois.
        </li>
      </ul>
      <p>
        Les prix en vigueur sont affichés sur la page de tarifs au moment de la souscription, en euros,
        toutes taxes comprises pour un consommateur ; la TVA applicable dépend de la situation du client.
        Une régénération ou une « autre idée » compte comme une génération. Les quotas non utilisés ne
        se reportent pas d&apos;un mois sur l&apos;autre. Un dépassement entraîne le refus de la génération
        jusqu&apos;au renouvellement ; aucune facturation à l&apos;usage n&apos;est appliquée. La génération
        d&apos;images est soumise à une limitation de débit raisonnable, destinée à prévenir les abus.
      </p>

      <h2 style={sectionTitleStyle}>7. Commande et paiement</h2>
      <p>
        La souscription se fait en ligne, depuis l&apos;espace de facturation de votre compte, auprès de
        notre prestataire de paiement Stripe. Les paiements par carte sont traités par Stripe :
        l&apos;éditeur n&apos;a jamais accès à vos coordonnées bancaires complètes. L&apos;abonnement démarre
        au paiement, pour une durée d&apos;un mois, et se renouvelle tacitement chaque mois par prélèvement
        sur le moyen de paiement enregistré, jusqu&apos;à résiliation. Les factures sont disponibles depuis
        l&apos;espace de facturation. En cas d&apos;échec de paiement, l&apos;accès aux fonctionnalités payantes
        est suspendu jusqu&apos;à régularisation.
      </p>

      <h2 style={sectionTitleStyle}>8. Résiliation de l&apos;abonnement</h2>
      <p>
        Vous pouvez résilier à tout moment depuis l&apos;espace de facturation de votre compte (« Gérer mon
        abonnement »). La résiliation prend effet à la fin de la période déjà payée : vous conservez
        l&apos;accès jusqu&apos;à cette date, et aucun remboursement au prorata n&apos;est dû, sauf disposition
        légale contraire. Vous revenez ensuite aux limites de l&apos;essai gratuit, vos données restant
        accessibles.
      </p>

      <h2 style={sectionTitleStyle}>9. Droit de rétractation</h2>
      <p>
        Si vous souscrivez en tant que consommateur, vous disposez en principe d&apos;un délai de
        rétractation de quatorze jours. Le service étant un contenu numérique fourni sans support
        matériel et accessible immédiatement après le paiement, vous demandez expressément, en
        souscrivant, que l&apos;exécution commence dès la souscription, et vous reconnaissez que vous
        perdez votre droit de rétractation une fois l&apos;exécution commencée (code de la consommation,
        article L221-28, 13°). L&apos;essai gratuit vous permet d&apos;évaluer le service avant tout paiement.
        Un professionnel ne bénéficie pas du droit de rétractation.
      </p>

      <h2 style={sectionTitleStyle}>10. Modification des prix et des conditions</h2>
      <p>
        L&apos;éditeur peut modifier ses prix et les présentes conditions. Toute modification qui vous
        affecte vous est notifiée par email au moins un mois avant son entrée en vigueur ; vous pouvez
        résilier avant cette date si vous ne l&apos;acceptez pas. Les modifications sans incidence sur vos
        droits (précisions, nouvelles fonctionnalités) peuvent s&apos;appliquer immédiatement.
      </p>

      <h2 style={sectionTitleStyle}>11. Usage acceptable</h2>
      <p>
        Vous vous engagez à ne pas utiliser {SERVICE_NAME} pour générer ou diffuser du contenu illégal,
        diffamatoire, trompeur, ou portant atteinte aux droits de tiers, et à ne pas utiliser le service
        d&apos;une manière qui violerait les conditions des plateformes tierces connectées ou des
        fournisseurs de modèles d&apos;IA. Tout usage abusif (spam, partage de compte, contournement des
        limites techniques) peut entraîner la suspension ou la fermeture du compte, sans remboursement
        de la période en cours.
      </p>

      <h2 style={sectionTitleStyle}>12. Disponibilité du service</h2>
      <p>
        {SERVICE_NAME} est fourni en l&apos;état, sans garantie de disponibilité continue. Le service peut
        évoluer, être temporairement interrompu pour maintenance, ou dépendre de la disponibilité de
        prestataires tiers (modèles d&apos;IA, plateformes connectées, hébergement). L&apos;éditeur fait ses
        meilleurs efforts pour limiter ces interruptions et vous en informer.
      </p>

      <h2 style={sectionTitleStyle}>13. Suppression du compte</h2>
      <p>
        Vous pouvez supprimer votre compte à tout moment depuis les paramètres (onglet « Compte »).
        L&apos;abonnement éventuel est résilié immédiatement, sans remboursement de la période en cours, et
        vos données sont effacées comme décrit dans la{" "}
        <Link href="/legal/confidentialite">politique de confidentialité</Link>. Vous pouvez
        télécharger une copie de vos données avant de supprimer votre compte. L&apos;éditeur se réserve le
        droit de fermer un compte en cas de violation des présentes conditions.
      </p>

      <h2 style={sectionTitleStyle}>14. Propriété intellectuelle du service</h2>
      <p>
        Le service, sa structure, ses textes, ses graphismes et ses logos restent la propriété de
        l&apos;éditeur. Les présentes conditions ne vous accordent qu&apos;un droit d&apos;utilisation personnel
        et non transférable du service.
      </p>

      <h2 style={sectionTitleStyle}>15. Responsabilité</h2>
      <p>
        Dans la limite permise par la loi applicable, la responsabilité de l&apos;éditeur ne saurait
        excéder les sommes effectivement versées par l&apos;utilisateur au titre de son abonnement au cours
        des douze derniers mois. L&apos;éditeur ne saurait être tenu responsable des dommages indirects,
        ni des conséquences d&apos;un contenu généré par IA publié sans relecture préalable, ni d&apos;une
        indisponibilité imputable à un prestataire tiers. Rien dans les présentes ne limite la
        responsabilité de l&apos;éditeur dans les cas où la loi l&apos;interdit.
      </p>

      <h2 style={sectionTitleStyle}>16. Droit applicable et litiges</h2>
      <p>
        Les présentes conditions sont soumises au droit français. En cas de litige, vous êtes invité à
        contacter d&apos;abord l&apos;éditeur à {PUBLISHER.contactEmail} pour rechercher une solution amiable.
        Un consommateur peut ensuite recourir gratuitement au médiateur de la consommation dont relève
        l&apos;éditeur : {PUBLISHER.consumerMediator.name} ({PUBLISHER.consumerMediator.url}), ou à la
        plateforme européenne de règlement en ligne des litiges (ec.europa.eu/consumers/odr). À défaut,
        le litige relève des tribunaux français compétents.
      </p>

      <h2 style={sectionTitleStyle}>Contact</h2>
      <p>Pour toute question relative aux présentes conditions : {PUBLISHER.contactEmail}.</p>
    </LegalPage>
  );
}
