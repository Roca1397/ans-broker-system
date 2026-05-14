-- ============================================================
-- ANS BROKER SYSTEM - Migration 002 - Outlook / Power Automate
-- ============================================================
-- Esta migración EXTIENDE la base de datos existente (001_init.sql).
-- Es idempotente: puede ejecutarse múltiples veces sin error.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ───────────────────────────────────────────────────────────
-- 1) NUEVOS CATÁLOGOS
-- ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tipos_solicitud (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS estados_solicitud (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prioridades (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ramos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL UNIQUE,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────────
-- 2) ASOCIACIÓN CLIENTE <-> REMITENTE
-- ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clientes_remitentes (
    id SERIAL PRIMARY KEY,
    cliente VARCHAR(255) NOT NULL,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    remitente VARCHAR(255) NOT NULL,
    aseguradora_id INTEGER REFERENCES aseguradoras(id) ON DELETE SET NULL,
    ramo_id INTEGER REFERENCES ramos(id) ON DELETE SET NULL,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_remitente_cliente UNIQUE (remitente, cliente)
);

CREATE INDEX IF NOT EXISTS idx_clientes_remitentes_remitente
    ON clientes_remitentes (LOWER(remitente));

-- ───────────────────────────────────────────────────────────
-- 3) AMPLIAR LA TABLA `solicitudes`
-- ───────────────────────────────────────────────────────────

ALTER TABLE solicitudes ALTER COLUMN numero_solicitud DROP NOT NULL;
ALTER TABLE solicitudes ALTER COLUMN fecha_ingreso DROP NOT NULL;
ALTER TABLE solicitudes ALTER COLUMN cantidad_asegurados DROP NOT NULL;
ALTER TABLE solicitudes ALTER COLUMN tiempo_estimado_atencion DROP NOT NULL;
ALTER TABLE solicitudes ALTER COLUMN fecha_esperada_atencion DROP NOT NULL;

ALTER TABLE solicitudes DROP CONSTRAINT IF EXISTS solicitudes_estado_check;
ALTER TABLE solicitudes DROP CONSTRAINT IF EXISTS solicitudes_fuente_check;

ALTER TABLE solicitudes
    ADD COLUMN IF NOT EXISTS nro_ticket VARCHAR(20) UNIQUE,
    ADD COLUMN IF NOT EXISTS cliente VARCHAR(255) DEFAULT 'Pendiente de asignar',
    ADD COLUMN IF NOT EXISTS remitente VARCHAR(255),
    ADD COLUMN IF NOT EXISTS tipo_solicitud_id INTEGER REFERENCES tipos_solicitud(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS estado_id INTEGER REFERENCES estados_solicitud(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS prioridad_id INTEGER REFERENCES prioridades(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS ramo_id INTEGER REFERENCES ramos(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS asunto VARCHAR(500),
    ADD COLUMN IF NOT EXISTS cuerpo_correo TEXT,
    ADD COLUMN IF NOT EXISTS fecha_recepcion TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS fecha_finalizado TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS datos_adjuntos JSONB,
    ADD COLUMN IF NOT EXISTS probabilidad FLOAT,
    ADD COLUMN IF NOT EXISTS prediccion VARCHAR(50),
    ADD COLUMN IF NOT EXISTS comentarios TEXT;

ALTER TABLE aseguradoras
    ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

UPDATE aseguradoras SET activo = is_active WHERE activo IS NULL;

CREATE INDEX IF NOT EXISTS idx_solicitudes_nro_ticket ON solicitudes (nro_ticket);
CREATE INDEX IF NOT EXISTS idx_solicitudes_remitente ON solicitudes (LOWER(remitente));
CREATE INDEX IF NOT EXISTS idx_solicitudes_prediccion ON solicitudes (prediccion);
CREATE INDEX IF NOT EXISTS idx_solicitudes_prioridad ON solicitudes (prioridad_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado_id ON solicitudes (estado_id);

-- ───────────────────────────────────────────────────────────
-- 4) SEED DATA
-- ───────────────────────────────────────────────────────────

INSERT INTO tipos_solicitud (nombre) VALUES
    ('Inclusión'), ('Exclusión'), ('Renovación'), ('Emisión')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO estados_solicitud (nombre) VALUES
    ('Pendiente'), ('En Proceso'), ('Finalizado')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO prioridades (nombre) VALUES
    ('Baja'), ('Media'), ('Alta')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO ramos (nombre) VALUES
    ('EPS'), ('FOLA'), ('SCTR-S'), ('SCTR-P')
ON CONFLICT (nombre) DO NOTHING;

-- Triggers updated_at para los nuevos catálogos
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'tipos_solicitud','estados_solicitud','prioridades','ramos',
        'clientes','clientes_remitentes','aseguradoras'
    ])
    LOOP
        EXECUTE format(
          'DROP TRIGGER IF EXISTS update_%s_updated_at ON %s;', t, t
        );
        EXECUTE format(
          'CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %s
             FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();', t, t
        );
    END LOOP;
END$$;

COMMENT ON COLUMN solicitudes.nro_ticket IS 'Identificador único: NT{AÑO}{correlativo} (NT2026001)';
COMMENT ON COLUMN solicitudes.probabilidad IS 'Probabilidad ML 0-1 de incumplir ANS';
COMMENT ON COLUMN solicitudes.prediccion IS '"Dentro de ANS" | "Fuera de ANS"';
COMMENT ON TABLE clientes_remitentes IS 'Mapea correos remitentes a clientes para autocompletar solicitudes desde Outlook';
