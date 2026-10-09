-- Fresh local database only. Password values are supplied by the launcher.
CREATE ROLE auth_owner LOGIN PASSWORD :'auth_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE ROLE links_owner LOGIN PASSWORD :'links_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE ROLE analytics_owner LOGIN PASSWORD :'analytics_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA app_auth AUTHORIZATION auth_owner;
CREATE SCHEMA app_links AUTHORIZATION links_owner;
CREATE SCHEMA app_analytics AUTHORIZATION analytics_owner;
CREATE DATABASE short_url_test OWNER short_admin;
\connect short_url_test
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA app_auth AUTHORIZATION auth_owner;
CREATE SCHEMA app_links AUTHORIZATION links_owner;
CREATE SCHEMA app_analytics AUTHORIZATION analytics_owner;
