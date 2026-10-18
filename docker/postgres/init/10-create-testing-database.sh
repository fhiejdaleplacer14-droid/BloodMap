#!/bin/sh
# Creates the database used by the backend test suite (phpunit) on first start.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE "${DB_TEST_DATABASE}" OWNER "${POSTGRES_USER}"'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_TEST_DATABASE}')\gexec
EOSQL
