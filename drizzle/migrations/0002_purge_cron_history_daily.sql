DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='purge-cron-history') THEN
    PERFORM cron.unschedule('purge-cron-history');
  END IF;
  PERFORM cron.schedule('purge-cron-history', '15 4 * * *',
    $c$ DELETE FROM cron.job_run_details WHERE end_time < now() - interval '3 days'; $c$);
END $$;