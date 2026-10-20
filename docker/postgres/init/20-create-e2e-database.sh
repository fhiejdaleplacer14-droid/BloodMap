#!/bin/sh
# Creates the database the Playwright flows (frontend/e2e) reset and seed on every run.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE "${DB_E2E_DATABASE}" OWNER "${POSTGRES_USER}"'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_E2E_DATABASE}')\gexec
EOSQL
