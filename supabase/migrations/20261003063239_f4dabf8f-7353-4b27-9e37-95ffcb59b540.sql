DELETE FROM cron.job_run_details WHERE end_time < now() - interval '1 day';

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'cleanup-cron-logs';

SELECT cron.schedule(
  'cleanup-cron-logs',
  '15 3 * * *',
  $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '1 day'$$
);