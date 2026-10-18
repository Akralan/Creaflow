CREATE TABLE "post_animations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"script_id" uuid NOT NULL,
	"html" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"concept" text DEFAULT '' NOT NULL,
	"beats" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "post_animations_script_id_unique" UNIQUE("script_id")
);
--> statement-breakpoint
ALTER TABLE "post_animations" ADD CONSTRAINT "post_animations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_animations" ADD CONSTRAINT "post_animations_script_id_scripts_id_fk" FOREIGN KEY ("script_id") REFERENCES "public"."scripts"("id") ON DELETE cascade ON UPDATE no action;