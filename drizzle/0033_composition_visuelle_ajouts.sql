ALTER TABLE "brand_assets" ADD COLUMN "cutout_key" text;--> statement-breakpoint
ALTER TABLE "visual_designs" ADD COLUMN "images" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
-- Migration de données (docs/SPEC_COMPOSITION_VISUELLE.md §4), écrite à la main avant la suppression
-- des anciennes colonnes (0034). Une maquette bâtie sur une photo de la bibliothèque encore présente
-- garde sa photo sous la référence p1 ; le placeholder {{BASE_IMAGE}} devient {{IMG:p1}} dans le HTML.
UPDATE "visual_designs"
SET "images" = jsonb_build_array(jsonb_build_object('ref', 'p1', 'assetId', "base_asset_id", 'variant', 'original')),
    "slides" = replace("slides"::text, '{{BASE_IMAGE}}', '{{IMG:p1}}')::jsonb
WHERE "base_kind" = 'asset' AND "base_asset_id" IS NOT NULL;--> statement-breakpoint
-- Une maquette bâtie sur une photo générée par IA (la table generated_images est supprimée en 0034),
-- ou sur une photo de la bibliothèque disparue depuis, est SUPPRIMÉE : son HTML citerait une image
-- qui n'existe plus et la liste blanche refuserait toute retouche. La fiche du script retombe sur
-- « Choisir des photos » / « Sans photo » et l'utilisateur recompose avec de vraies photos.
DELETE FROM "visual_designs"
WHERE "base_kind" = 'generated' OR ("base_kind" = 'asset' AND "base_asset_id" IS NULL);
