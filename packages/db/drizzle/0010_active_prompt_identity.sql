-- Archive redundant configuration only. Chats and their original prompt IDs stay intact.
WITH ranked AS (
  SELECT p.id, row_number() OVER (
    PARTITION BY p.project_id, upper(btrim(p.country_code)),
      lower(regexp_replace(btrim(p.text), '\s+', ' ', 'g'))
    ORDER BY (SELECT count(*) FROM chat c WHERE c.prompt_id = p.id) DESC, p.id
  ) AS ordinal
  FROM prompt p WHERE p.status = 'active'
)
UPDATE prompt SET status = 'archived'
WHERE id IN (SELECT id FROM ranked WHERE ordinal > 1);

CREATE UNIQUE INDEX IF NOT EXISTS prompt_active_identity_unique
ON prompt (project_id, upper(btrim(country_code)), lower(regexp_replace(btrim(text), '\s+', ' ', 'g')))
WHERE status = 'active';
