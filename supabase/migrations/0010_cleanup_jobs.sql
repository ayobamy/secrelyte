-- 0010_cleanup_jobs.sql
-- No job deletes users. See ADR-0003.

SELECT cron.schedule('purge-verifications', '0 3 * * *', $$
  DELETE FROM public.share_verifications WHERE expires_at < now() - interval '1 day';
$$);

SELECT cron.schedule('purge-share-payloads', '15 3 * * *', $$
  UPDATE public.shared_links
     SET payload_ciphertext = '\x'::bytea,
         wrapped_sdek       = '\x'::bytea
   WHERE expires_at < now() - interval '30 days'
     AND octet_length(payload_ciphertext) > 0;
$$);
