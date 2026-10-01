-- Unschedule any existing jobs that call /api/cron/run, then create the
-- canonical job using net.http_post (pg_net) with the cron_secret from Vault.

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE command LIKE '%/api/cron/run%';

SELECT cron.schedule(
  'crm-cron-run',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url    := 'https://crm.gingaglobalgroup.com/api/cron/run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'cron_secret'
        LIMIT 1
      )
    ),
    body   := '{}'::jsonb
  );
  $$
);
