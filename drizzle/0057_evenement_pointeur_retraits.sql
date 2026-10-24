-- docs/SPEC_EVENEMENT_POINTEUR.md §2 — un événement perd tous ses champs.
--
-- Les événements existants sont INUTILISABLES après ce retrait : ils n'ont pas de `line`, et
-- rien dans leur contenu ne permet de la retrouver. La matière est simplement relue par
-- l'extracteur de pointeurs. On vide donc la table, et on détache les scripts qui la référencent
-- pour que la FK ne retienne pas des lignes supprimées.
UPDATE "scripts" SET "event_id" = NULL;--> statement-breakpoint
DELETE FROM "material_events";--> statement-breakpoint
ALTER TABLE "material_events" DROP CONSTRAINT "material_events_source_material_id_source_materials_id_fk";
--> statement-breakpoint
ALTER TABLE "material_events" ALTER COLUMN "source_material_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "material_events" ADD CONSTRAINT "material_events_source_material_id_source_materials_id_fk" FOREIGN KEY ("source_material_id") REFERENCES "public"."source_materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_events" DROP COLUMN "date_precision";--> statement-breakpoint
ALTER TABLE "material_events" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "material_events" DROP COLUMN "what_happened";--> statement-breakpoint
ALTER TABLE "material_events" DROP COLUMN "what_changed";--> statement-breakpoint
ALTER TABLE "material_events" DROP COLUMN "at_stake";--> statement-breakpoint
ALTER TABLE "material_events" DROP COLUMN "kind";--> statement-breakpoint
ALTER TABLE "material_events" DROP COLUMN "audiences";--> statement-breakpoint
ALTER TABLE "material_events" DROP COLUMN "audience_angles";--> statement-breakpoint
ALTER TABLE "material_events" DROP COLUMN "qualified_at";--> statement-breakpoint
ALTER TABLE "material_events" DROP COLUMN "excerpt";--> statement-breakpoint
ALTER TABLE "material_events" DROP COLUMN "origin";--> statement-breakpoint
DROP TYPE "public"."material_event_date_precision";--> statement-breakpoint
DROP TYPE "public"."material_event_kind";--> statement-breakpoint
DROP TYPE "public"."material_event_origin";