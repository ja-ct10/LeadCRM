BEGIN;
SET LOCAL TIME ZONE 'UTC';
DO $$ DECLARE definition text; BEGIN
  SELECT pg_get_constraintdef(oid) INTO definition FROM pg_constraint WHERE conname='NotificationEvent_type_check' AND conrelid='"NotificationEvent"'::regclass;
  ALTER TABLE "NotificationEvent" DROP CONSTRAINT "NotificationEvent_type_check";
  EXECUTE 'ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_type_check" CHECK ((' || substring(definition from 8 for length(definition)-8) || ') OR type = ''password_expiring_soon'')';
END $$;
CREATE FUNCTION crm_password_expiring_notification() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."passwordChangedAt" IS NOT NULL AND NEW."passwordHash" IS NOT NULL AND
    (TG_OP='INSERT' OR OLD."passwordChangedAt" IS DISTINCT FROM NEW."passwordChangedAt") THEN
    PERFORM crm_enqueue_notification(NEW."tenantId", 'password-expiring:'||NEW.id||':'||to_char(NEW."passwordChangedAt",'YYYY-MM-DD"T"HH24:MI:SS.MS'),
      'password_expiring_soon','PasswordSecurity',NEW.id,NEW.id,false,NULL,
      jsonb_build_object('passwordChangedAt',to_char(NEW."passwordChangedAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
      NEW."passwordChangedAt" + interval '89 days');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER crm_password_expiring_notification AFTER INSERT OR UPDATE OF "passwordChangedAt" ON "User"
  FOR EACH ROW EXECUTE FUNCTION crm_password_expiring_notification();
INSERT INTO "NotificationEvent" (id,"tenantId","eventKey",type,"entityType","entityId","ownerId",payload,"occurredAt","availableAt")
SELECT gen_random_uuid()::text,"tenantId",'password-expiring:'||id||':'||to_char("passwordChangedAt",'YYYY-MM-DD"T"HH24:MI:SS.MS'),
  'password_expiring_soon','PasswordSecurity',id,id,
  jsonb_build_object('passwordChangedAt',to_char("passwordChangedAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  "passwordChangedAt" + interval '89 days',"passwordChangedAt" + interval '89 days'
FROM "User" WHERE "passwordChangedAt" IS NOT NULL AND "passwordHash" IS NOT NULL
  AND "passwordChangedAt" + interval '90 days' > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
ON CONFLICT ("tenantId","eventKey") DO NOTHING;
COMMIT;
