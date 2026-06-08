-- ============================================================
-- Migración 003: Eliminar columnas legadas de la tabla solicitudes
-- Ejecutar en pgAdmin o psql contra la base de datos del proyecto.
-- ============================================================

BEGIN;

-- 1. Eliminar FK a tipos_operacion (tipo_operacion_id)
ALTER TABLE solicitudes
  DROP CONSTRAINT IF EXISTS solicitudes_tipo_operacion_id_fkey;

-- 2. Eliminar FK a users (usuario_id — distinto del FK de ejecutivo_id)
ALTER TABLE solicitudes
  DROP CONSTRAINT IF EXISTS solicitudes_usuario_id_fkey;

-- 3. Eliminar índice de numero_solicitud (UNIQUE implica un índice)
DROP INDEX IF EXISTS solicitudes_numero_solicitud_key;

-- 4. Eliminar las columnas
ALTER TABLE solicitudes
  DROP COLUMN IF EXISTS numero_solicitud,
  DROP COLUMN IF EXISTS fecha_ingreso,
  DROP COLUMN IF EXISTS tipo_operacion_id,
  DROP COLUMN IF EXISTS cantidad_asegurados,
  DROP COLUMN IF EXISTS tiempo_estimado_atencion,
  DROP COLUMN IF EXISTS fecha_esperada_atencion,
  DROP COLUMN IF EXISTS usuario_id,
  DROP COLUMN IF EXISTS observaciones;

-- 5. Eliminar índice heredado de fecha_ingreso (si existía)
DROP INDEX IF EXISTS idx_solicitudes_fecha_ingreso;

COMMIT;
