import type { materialSources } from "@/db/schema";

/** Miroir de `materialSourceTypeEnum` (src/db/schema.ts). Ajouter un connecteur = ajouter une
 *  valeur ici ET dans l'enum PostgreSQL, puis enregistrer l'implémentation dans le registre. */
export type MaterialSourceType = (typeof materialSources.$inferSelect)["type"];

export type MaterialSourceRow = typeof materialSources.$inferSelect;

/**
 * Une source branchable, proposée à l'utilisateur avant d'exister en base.
 *
 * `Meta` porte ce que seule l'UI du connecteur sait afficher (langage et date de push pour un
 * dépôt, nombre de ventes pour une boutique…). Le cœur ne le lit jamais : il le transporte.
 */
export interface ConnectorCandidate<Meta = Record<string, unknown>> {
  externalId: string;
  /** Identifiant lisible, stocké tel quel dans `materialSources.label` ("owner/repo"). */
  label: string;
  /** Nom et description du sujet créé avec la source. */
  subjectName: string;
  subjectDescription: string | null;
  /** Écrit dans `materialSources.config` — relu par le connecteur seul. */
  config: Record<string, unknown>;
  meta: Meta;
}

/** Un document que la source produit. `externalRef` l'identifie DANS sa source (chemin de fichier,
 *  id de page…), `externalChecksum` est ce dont la comparaison rend le re-sync idempotent. */
export interface IncomingDoc {
  externalRef: string;
  externalChecksum: string;
  title: string;
  rawText: string;
}

export interface FetchedDocuments {
  docs: IncomingDoc[];
  /** Position de lecture à mémoriser dans `materialSources.syncCursor`, ou null. */
  cursor: string | null;
  /** La source a plus à donner que ce qui a été lu — signalé à l'utilisateur sans passer la source
   *  en erreur : une ingestion partielle n'est pas un échec. */
  truncated: boolean;
}

/**
 * Contrat d'une source de matière externe. Tout ce qui est spécifique à un fournisseur vit ici ;
 * le diff, l'écriture des documents miroir et la gestion de statut restent dans
 * `sourceConnectorService` (docs/ARCHITECTURE_VERTICALES.md §4, chantier 1).
 */
export interface SourceConnector<Meta = Record<string, unknown>> {
  type: MaterialSourceType;

  /** Nom du fournisseur tel qu'on le montre à l'utilisateur ("GitHub", "Notion"). Remonté par
   *  l'API avec chaque source, pour que l'UI générique n'ait pas à coder le nom en dur. */
  displayName: string;

  /** Lève si le compte tiers n'est pas connecté. Permet d'échouer AVANT de créer des sujets :
   *  sans ça, l'erreur d'accès n'apparaîtrait qu'au premier fetch, une fois les sujets déjà écrits. */
  assertReady(userId: string): Promise<void>;

  /** Ce que l'utilisateur peut brancher. Lève si le compte tiers n'est pas connecté. */
  listCandidates(userId: string): Promise<ConnectorCandidate<Meta>[]>;

  /** Ce que la source devrait produire, sans rien écrire en base. */
  fetchDocuments(userId: string, source: MaterialSourceRow): Promise<FetchedDocuments>;

  /** true quand l'erreur veut dire « l'accès est perdu » plutôt que « la source est en panne » :
   *  c'est ce qui distingue le statut `needs_reconnect` du statut `error`. */
  isAuthError(error: unknown): boolean;

  /** Messages portés par `materialSources.lastError`. Formulés par le connecteur parce qu'ils
   *  parlent de SA source ("ce dépôt", "cette boutique"), pas d'une source abstraite. */
  emptyMessage: string;
  truncatedMessage: string;

  /** Ligne de contexte affichée sous un candidat dans l'écran de sélection ("TypeScript · mis à
   *  jour le …"). C'est ce qui permet à cet écran de rester générique : il affiche une chaîne, il
   *  ne lit jamais `meta`, dont lui seul connaîtrait la forme. Absent = pas de ligne. */
  candidateHint?(meta: Meta): string | null;

  /** Textes de l'écran de sélection, portés par le connecteur pour la même raison que
   *  `emptyMessage` : ils parlent de SA source. */
  picker?: {
    /** Affiché quand le fournisseur ne propose rien — le cas Notion sans page partagée, où il faut
     *  expliquer le partage plutôt que montrer une liste vide. */
    emptyMessage: string;
    /** Bas de l'écran : ce que l'ingestion va récupérer. */
    footnote: string;
  };
}
