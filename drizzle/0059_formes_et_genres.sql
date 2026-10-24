CREATE TYPE "public"."material_event_genre" AS ENUM('livraison', 'annonce', 'décision', 'question', 'chiffre', 'échec', 'leçon', 'engagement', 'offre', 'retour_utilisateur', 'déclencheur', 'coulisse', 'réaction');--> statement-breakpoint
CREATE TYPE "public"."post_form" AS ENUM('episode', 'launch', 'teaser', 'number', 'failure', 'lesson', 'proof', 'promise', 'promise_kept', 'looking_back', 'offer', 'question', 'backstage', 'curation', 'origin');--> statement-breakpoint
ALTER TABLE "material_events" ADD COLUMN "genre" "material_event_genre" DEFAULT 'livraison' NOT NULL;--> statement-breakpoint
ALTER TABLE "material_events" ADD COLUMN "disponible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "material_events" ADD COLUMN "tient" uuid;--> statement-breakpoint
ALTER TABLE "scripts" ADD COLUMN "form" "post_form";--> statement-breakpoint
ALTER TABLE "material_events" ADD CONSTRAINT "material_events_tient_material_events_id_fk" FOREIGN KEY ("tient") REFERENCES "public"."material_events"("id") ON DELETE set null ON UPDATE no action;