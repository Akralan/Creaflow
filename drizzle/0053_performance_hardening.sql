ALTER TABLE "post_match_candidates" DROP CONSTRAINT "post_match_candidates_platform_platform_post_id_unique";--> statement-breakpoint
ALTER TABLE "creator_profiles" ADD COLUMN "x_last_read_at" timestamp;--> statement-breakpoint
ALTER TABLE "post_match_candidates" ADD CONSTRAINT "post_match_candidates_user_id_platform_platform_post_id_unique" UNIQUE("user_id","platform","platform_post_id");