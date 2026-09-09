ALTER TYPE "public"."vertical" ADD VALUE 'artisan';--> statement-breakpoint
ALTER TYPE "public"."vertical" ADD VALUE 'entrepreneur';--> statement-breakpoint
ALTER TYPE "public"."material_source_type" ADD VALUE 'notion_page';--> statement-breakpoint
ALTER TYPE "public"."material_source_type" ADD VALUE 'linear_project';--> statement-breakpoint
ALTER TABLE "github_accounts" RENAME TO "oauth_accounts";--> statement-breakpoint
ALTER TABLE "oauth_accounts" RENAME COLUMN "github_user_id" TO "provider_user_id";--> statement-breakpoint
ALTER TABLE "oauth_accounts" RENAME CONSTRAINT "github_accounts_user_id_users_id_fk" TO "oauth_accounts_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "oauth_accounts" DROP CONSTRAINT "github_accounts_user_id_unique";--> statement-breakpoint
ALTER TABLE "oauth_accounts" DROP CONSTRAINT "github_accounts_github_user_id_unique";--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD COLUMN "provider" text;--> statement-breakpoint
UPDATE "oauth_accounts" SET "provider" = 'github';--> statement-breakpoint
ALTER TABLE "oauth_accounts" ALTER COLUMN "provider" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD COLUMN "refresh_token" text;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD COLUMN "access_token_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD COLUMN "config" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_provider_provider_user_id_unique" UNIQUE("provider","provider_user_id");--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_provider_unique" UNIQUE("user_id","provider");
