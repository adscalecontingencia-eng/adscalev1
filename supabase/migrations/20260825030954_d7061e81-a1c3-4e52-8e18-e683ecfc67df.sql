SELECT cron.unschedule('referral-milestone-alerts-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'referral-milestone-alerts-daily');

SELECT cron.schedule(
  'referral-milestone-alerts-daily',
  '30 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://etojigjmeselsqptjkil.supabase.co/functions/v1/referral-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);