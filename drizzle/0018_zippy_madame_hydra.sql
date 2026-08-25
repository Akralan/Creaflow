ALTER TABLE "scripts" ADD COLUMN "concept" text;--> statement-breakpoint
ALTER TABLE "scripts" ADD COLUMN "rejected_concepts" jsonb DEFAULT '[]'::jsonb NOT NULL;