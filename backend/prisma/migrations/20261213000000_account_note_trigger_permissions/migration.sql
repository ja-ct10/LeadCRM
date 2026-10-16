BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- Account writes must preserve notes without granting the runtime role access
-- to operator-only history. Keep the existing migration owner and private helper.
ALTER FUNCTION crm_history.preserve_account_note_write() SECURITY DEFINER;
ALTER FUNCTION crm_history.preserve_account_note_write()
  SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL ON FUNCTION crm_history.preserve_account_note_write() FROM PUBLIC;

COMMIT;
