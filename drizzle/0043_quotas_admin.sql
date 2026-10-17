ALTER TABLE "script_generation_events" DROP CONSTRAINT "script_generation_events_script_id_scripts_id_fk";
--> statement-breakpoint
ALTER TABLE "script_micro_edit_events" DROP CONSTRAINT "script_micro_edit_events_script_id_scripts_id_fk";
--> statement-breakpoint
ALTER TABLE "script_generation_events" ALTER COLUMN "script_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "script_micro_edit_events" ALTER COLUMN "script_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "script_limit" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "micro_edit_limit" integer;--> statement-breakpoint
ALTER TABLE "script_generation_events" ADD CONSTRAINT "script_generation_events_script_id_scripts_id_fk" FOREIGN KEY ("script_id") REFERENCES "public"."scripts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_micro_edit_events" ADD CONSTRAINT "script_micro_edit_events_script_id_scripts_id_fk" FOREIGN KEY ("script_id") REFERENCES "public"."scripts"("id") ON DELETE set null ON UPDATE no action;