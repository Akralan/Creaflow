ALTER TABLE "content_series" ADD COLUMN "reader_label" text;--> statement-breakpoint
ALTER TABLE "content_series" ADD COLUMN "form" jsonb;--> statement-breakpoint
ALTER TABLE "scripts" ADD COLUMN "event_id" uuid;--> statement-breakpoint
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_event_id_material_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."material_events"("id") ON DELETE set null ON UPDATE no action;