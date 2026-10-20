CREATE TYPE "public"."calendar_entry_kind" AS ENUM('event', 'narrative');--> statement-breakpoint
CREATE TYPE "public"."narrative_kind" AS ENUM('origin', 'vision', 'checkpoint', 'promise');--> statement-breakpoint
ALTER TABLE "calendar_entries" ADD COLUMN "kind" "calendar_entry_kind" DEFAULT 'event' NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_entries" ADD COLUMN "narrative_kind" "narrative_kind";--> statement-breakpoint
ALTER TABLE "scripts" ADD COLUMN "promise_source_script_id" uuid;--> statement-breakpoint
ALTER TABLE "scripts" ADD COLUMN "promise_match" jsonb;--> statement-breakpoint
ALTER TABLE "scripts" ADD COLUMN "narrative_kind" "narrative_kind";--> statement-breakpoint
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_promise_source_script_id_scripts_id_fk" FOREIGN KEY ("promise_source_script_id") REFERENCES "public"."scripts"("id") ON DELETE set null ON UPDATE no action;