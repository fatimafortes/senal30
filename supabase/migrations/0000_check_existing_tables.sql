-- Not a migration — a read-only check.
-- Run this in the Supabase SQL Editor BEFORE running 0001_senal30_init.sql,
-- to confirm none of the senal30_ table names collide with existing tables
-- in this shared "semestre" project. This query changes nothing.

select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
