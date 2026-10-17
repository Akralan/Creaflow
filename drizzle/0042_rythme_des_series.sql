ALTER TABLE "content_series" ADD COLUMN "rhythm" jsonb;--> statement-breakpoint
ALTER TABLE "content_series" ADD COLUMN "skipped_slots" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
-- Reprise (docs/SPEC_RYTHME_DES_SERIES.md §2) : les jours de publication du profil sont répartis
-- entre les séries actives, la plus lourde d'abord (jour n° j → série n° j mod n) ; une série restée
-- sans jour partage le premier jour du profil. Une série seule prend donc tous les jours.
WITH s AS (
  SELECT id, user_id,
    row_number() OVER (PARTITION BY user_id ORDER BY weight DESC, created_at) - 1 AS rn,
    count(*) OVER (PARTITION BY user_id) AS n
  FROM content_series WHERE archived = false
), d AS (
  SELECT p.user_id, u.day, row_number() OVER (PARTITION BY p.user_id ORDER BY u.day) - 1 AS j
  FROM creator_profiles p, unnest(p.publishing_days) AS u(day)
)
UPDATE content_series cs SET rhythm = jsonb_build_object(
  'days', COALESCE(
    (SELECT jsonb_agg(d.day ORDER BY d.day) FROM d WHERE d.user_id = s.user_id AND d.j % s.n = s.rn),
    (SELECT jsonb_build_array(d.day) FROM d WHERE d.user_id = s.user_id ORDER BY d.j LIMIT 1),
    '[3]'::jsonb),
  'every', 1,
  'anchor', NULL)
FROM s WHERE cs.id = s.id;--> statement-breakpoint
-- Plus de posts libres générés : les créneaux libres vides à venir disparaissent (les rédigés restent).
DELETE FROM "calendar_entries"
WHERE series_id IS NULL AND script_id IS NULL AND status <> 'published' AND scheduled_date >= current_date;
