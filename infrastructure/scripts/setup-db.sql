-- LeadCRM Database Setup
-- Run this as the PostgreSQL superuser (postgres) ONCE before first migration
-- Command: psql -U postgres -f infrastructure/scripts/setup-db.sql

-- Replace 'YOUR_PASSWORD_HERE' with the password from backend/.env DATABASE_URL
-- (the part between the colon and @ symbol)

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'leadcrm') THEN
    CREATE ROLE leadcrm LOGIN PASSWORD 'YOUR_PASSWORD_HERE';
    RAISE NOTICE 'Role leadcrm created';
  ELSE
    RAISE NOTICE 'Role leadcrm already exists';
  END IF;
END
$$;

-- Create database if it doesn't exist
-- Note: CREATE DATABASE cannot run inside a transaction block
-- Run this part manually if the DO block above fails
-- CREATE DATABASE leadcrm_dev OWNER leadcrm;

GRANT ALL PRIVILEGES ON DATABASE leadcrm_dev TO leadcrm;
