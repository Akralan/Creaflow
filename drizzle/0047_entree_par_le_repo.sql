CREATE TYPE "public"."start_job_stage" AS ENUM('queued', 'profile', 'series', 'post', 'mailed', 'failed');--> statement-breakpoint
ALTER TYPE "public"."calendar_status" ADD VALUE 'generating';--> statement-breakpoint
CREATE TABLE "login_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "login_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "start_jobs" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"stage" "start_job_stage" DEFAULT 'queued' NOT NULL,
	"error" text,
	"mailed_at" timestamp,
	"other_posts_requested_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "problem" text;--> statement-breakpoint
ALTER TABLE "login_tokens" ADD CONSTRAINT "login_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "start_jobs" ADD CONSTRAINT "start_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;