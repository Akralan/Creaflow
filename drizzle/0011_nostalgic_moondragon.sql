CREATE TYPE "public"."script_micro_edit_kind" AS ENUM('selection_instruction', 'block_regenerate');--> statement-breakpoint
CREATE TABLE "script_micro_edit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"script_id" uuid NOT NULL,
	"kind" "script_micro_edit_kind" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scripts" ALTER COLUMN "title" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scripts" ADD COLUMN "first_draft_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "scripts" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "script_micro_edit_events" ADD CONSTRAINT "script_micro_edit_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_micro_edit_events" ADD CONSTRAINT "script_micro_edit_events_script_id_scripts_id_fk" FOREIGN KEY ("script_id") REFERENCES "public"."scripts"("id") ON DELETE cascade ON UPDATE no action;