CREATE TABLE "content_categories_platforms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"platform" text NOT NULL,
	CONSTRAINT "content_categories_platforms_category_id_platform_unique" UNIQUE("category_id","platform")
);
--> statement-breakpoint
CREATE TABLE "content_series_platforms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"series_id" uuid NOT NULL,
	"platform" text NOT NULL,
	CONSTRAINT "content_series_platforms_series_id_platform_unique" UNIQUE("series_id","platform")
);
--> statement-breakpoint
ALTER TABLE "posting_goals" ALTER COLUMN "target_count_per_week" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "content_categories_platforms" ADD CONSTRAINT "content_categories_platforms_category_id_content_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."content_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_series_platforms" ADD CONSTRAINT "content_series_platforms_series_id_content_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."content_series"("id") ON DELETE cascade ON UPDATE no action;