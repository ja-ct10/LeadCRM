# Private storage on Coolify

The backend uses private PostgreSQL for CRM records and a persistent filesystem
mount for avatars and attachments. Neither runtime path uses Supabase.

Configure the backend's persistent directory mount:

| Setting | Value |
| --- | --- |
| Source on server | `/data/coolify/leadcrm-private-files` |
| Destination in backend | `/var/lib/leadcrm/files` |
| Read-only | false |
| `STORAGE_ROOT` | `/var/lib/leadcrm/files` |
| `AVATAR_STORAGE_BUCKET` | `avatars` |
| `RECORD_FILES_STORAGE_BUCKET` | `crm-record-files` |

Create the source directory before deployment. It must be owned by the container
user, with directories mode 0700 and files mode 0600. Never mount or publish this
directory through the frontend or proxy. Existing authenticated file routes retain
tenant, active-record, permission and user checks. Storage rejects path traversal
and symlinks, writes complete objects atomically without overwriting existing
objects, and retains the existing 5 MB avatar / 10 MB attachment validation.

For migration, freeze application writes, enumerate both source storage buckets,
copy all objects with the exact bucket/key paths, and verify SHA-256 for every
object and every database-referenced avatar/file. Deploy the storage change and
mount together. Remove `SUPABASE_*` from the deployed runtime only after copying.
Keep source data and the old deployment's protected configuration until recovery
has been verified. No database schema or Prisma history change is needed.

Back up both PostgreSQL and this directory. A PostgreSQL dump contains file
metadata, not file bytes. Persistent storage survives redeployment; it does not
protect against losing the server. Configure an off-server private backup
destination and test downloading and restoring both archives.

If rollback is needed after new uploads, preserve the current directory and
database before changing providers. New files must be reconciled; restoring old
credentials alone would strand their bytes.

See [Coolify persistent storage](https://coolify.io/docs/applications/configuration/persistent-storage).
