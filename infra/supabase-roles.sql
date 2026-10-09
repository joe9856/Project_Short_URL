-- Run once on a NEW Supabase project, before Prisma migrate deploy.
-- Replace ALL passwords with different random hex values; do not commit filled SQL.
DO $$ BEGIN
 IF '<AUTH_PASSWORD_HEX>' LIKE '<%' OR '<LINK_PASSWORD_HEX>' LIKE '<%' OR '<ANALYTICS_PASSWORD_HEX>' LIKE '<%' THEN
  RAISE EXCEPTION 'Replace ALL password placeholders first';
 END IF;
END $$;
CREATE ROLE auth_owner LOGIN PASSWORD '<AUTH_PASSWORD_HEX>' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE links_owner LOGIN PASSWORD '<LINK_PASSWORD_HEX>' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE analytics_owner LOGIN PASSWORD '<ANALYTICS_PASSWORD_HEX>' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT auth_owner, links_owner, analytics_owner TO postgres;
CREATE SCHEMA app_auth AUTHORIZATION auth_owner;
CREATE SCHEMA app_links AUTHORIZATION links_owner;
CREATE SCHEMA app_analytics AUTHORIZATION analytics_owner;
GRANT CONNECT ON DATABASE postgres TO auth_owner, links_owner, analytics_owner;
-- Keep app_auth/app_links/app_analytics OUT of the Data API exposed schemas.
-- Runtime roles get no access to each other's schemas or Supabase's built-in auth.
