#!/bin/sh
set -eu
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -v ON_ERROR_STOP=1 \
  -v auth_password="$AUTH_DB_PASSWORD" -v links_password="$LINK_DB_PASSWORD" \
  -v analytics_password="$ANALYTICS_DB_PASSWORD" -f /opt/bootstrap.sql
