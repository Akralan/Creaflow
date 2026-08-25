ALTER TABLE "source_materials" ADD COLUMN "chunk_total" integer;--> statement-breakpoint
ALTER TABLE "source_materials" ADD COLUMN "chunk_processed" integer DEFAULT 0 NOT NULL;