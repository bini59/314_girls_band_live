-- Operator only: psql -X -qAt -v ON_ERROR_STOP=1 <connection> -f scripts/export-postgres.sql
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL TIME ZONE 'UTC';
SELECT jsonb_build_object(
  'series', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM series t),
  'work', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM work t),
  'tour', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM tour t),
  'band', (SELECT COALESCE(jsonb_agg(to_jsonb(t) || jsonb_build_object('sns_links__sql_null', t.sns_links IS NULL)), '[]'::jsonb) FROM band t),
  'live', (SELECT COALESCE(jsonb_agg(to_jsonb(t) || jsonb_build_object('official_urls__sql_null', t.official_urls IS NULL)), '[]'::jsonb) FROM live t),
  'live_band', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM live_band t),
  'live_format', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM live_format t),
  'ticket_tier', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM ticket_tier t),
  'vendor', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM vendor t),
  'ticket_sale', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM ticket_sale t),
  'ticket_sale_tier', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM ticket_sale_tier t),
  'api_key', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM api_key t)
);
COMMIT;
