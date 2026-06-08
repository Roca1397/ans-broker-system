-- ============================================================
-- Migración 004: Agregar columna nro_atenciones a solicitudes
-- Ejecutar en pgAdmin o psql.
-- ============================================================

ALTER TABLE solicitudes
ADD COLUMN IF NOT EXISTS nro_atenciones INTEGER DEFAULT 1;
