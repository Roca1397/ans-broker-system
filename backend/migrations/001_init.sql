-- ============================================================
-- ANS BROKER SYSTEM - PostgreSQL Migration Script
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'analyst')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ASEGURADORAS (Insurance companies catalog)
CREATE TABLE IF NOT EXISTS aseguradoras (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    ans_horas_limite INTEGER NOT NULL DEFAULT 48,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TIPOS DE OPERACION (Operation types catalog)
CREATE TABLE IF NOT EXISTS tipos_operacion (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    peso_complejidad FLOAT DEFAULT 1.0,
    is_active BOOLEAN DEFAULT TRUE
);

-- SOLICITUDES
CREATE TABLE IF NOT EXISTS solicitudes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_solicitud VARCHAR(50) UNIQUE NOT NULL,
    fecha_ingreso TIMESTAMP WITH TIME ZONE NOT NULL,
    tipo_operacion_id INTEGER REFERENCES tipos_operacion(id),
    aseguradora_id INTEGER REFERENCES aseguradoras(id),
    cantidad_asegurados INTEGER NOT NULL CHECK (cantidad_asegurados > 0),
    tiempo_estimado_atencion FLOAT NOT NULL,  -- horas
    fecha_esperada_atencion TIMESTAMP WITH TIME ZONE NOT NULL,
    estado VARCHAR(50) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_proceso', 'completado', 'vencido')),
    usuario_id UUID REFERENCES users(id),
    observaciones TEXT,
    fuente VARCHAR(50) DEFAULT 'manual' CHECK (fuente IN ('manual', 'excel', 'csv', 'api')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PREDICCIONES ANS
CREATE TABLE IF NOT EXISTS predicciones_ans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    solicitud_id UUID UNIQUE REFERENCES solicitudes(id) ON DELETE CASCADE,
    cumple_ans BOOLEAN NOT NULL,
    probabilidad_riesgo FLOAT NOT NULL CHECK (probabilidad_riesgo >= 0 AND probabilidad_riesgo <= 1),
    nivel_riesgo VARCHAR(20) NOT NULL CHECK (nivel_riesgo IN ('bajo', 'medio', 'alto', 'critico')),
    features_input JSONB,
    modelo_version VARCHAR(50),
    tiempo_prediccion_ms FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ALERTAS
CREATE TABLE IF NOT EXISTS alertas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    solicitud_id UUID REFERENCES solicitudes(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('alto_riesgo', 'vencimiento_proximo', 'incumplimiento', 'critico')),
    mensaje TEXT NOT NULL,
    leida BOOLEAN DEFAULT FALSE,
    usuario_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AUDIT LOG
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    tabla VARCHAR(100) NOT NULL,
    registro_id VARCHAR(100) NOT NULL,
    accion VARCHAR(20) NOT NULL CHECK (accion IN ('INSERT', 'UPDATE', 'DELETE')),
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    usuario_id UUID REFERENCES users(id),
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INDEXES
CREATE INDEX idx_solicitudes_fecha_ingreso ON solicitudes(fecha_ingreso DESC);
CREATE INDEX idx_solicitudes_estado ON solicitudes(estado);
CREATE INDEX idx_solicitudes_aseguradora ON solicitudes(aseguradora_id);
CREATE INDEX idx_solicitudes_usuario ON solicitudes(usuario_id);
CREATE INDEX idx_predicciones_nivel_riesgo ON predicciones_ans(nivel_riesgo);
CREATE INDEX idx_alertas_usuario_leida ON alertas(usuario_id, leida);

-- SEED DATA - Aseguradoras
INSERT INTO aseguradoras (nombre, codigo, ans_horas_limite) VALUES
    ('Rimac Seguros', 'RIMAC', 48),
    ('Pacífico Seguros', 'PACIFICO', 36),
    ('La Positiva', 'POSITIVA', 72),
    ('Mapfre Perú', 'MAPFRE', 48),
    ('Interseguro', 'INTERSEGURO', 24),
    ('Protecta Security', 'PROTECTA', 48),
    ('Secrex', 'SECREX', 36),
    ('Ohio National', 'OHIO', 72)
ON CONFLICT (codigo) DO NOTHING;

-- SEED DATA - Tipos de operación
INSERT INTO tipos_operacion (nombre, codigo, peso_complejidad) VALUES
    ('Alta de Póliza', 'ALTA_POLIZA', 1.0),
    ('Renovación', 'RENOVACION', 0.8),
    ('Cancelación', 'CANCELACION', 0.6),
    ('Modificación de Cobertura', 'MOD_COBERTURA', 1.2),
    ('Inclusión de Asegurado', 'INCLUSION', 0.7),
    ('Exclusión de Asegurado', 'EXCLUSION', 0.6),
    ('Siniestro', 'SINIESTRO', 2.0),
    ('Endoso', 'ENDOSO', 1.1),
    ('Cotización', 'COTIZACION', 0.5),
    ('Facturación', 'FACTURACION', 0.9)
ON CONFLICT (codigo) DO NOTHING;

-- FUNCTION: Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_solicitudes_updated_at
    BEFORE UPDATE ON solicitudes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- VIEW: Solicitudes con predicciones
CREATE OR REPLACE VIEW v_solicitudes_predicciones AS
SELECT 
    s.id,
    s.numero_solicitud,
    s.fecha_ingreso,
    s.fecha_esperada_atencion,
    s.cantidad_asegurados,
    s.tiempo_estimado_atencion,
    s.estado,
    s.fuente,
    s.created_at,
    to_name.nombre AS tipo_operacion,
    to_name.codigo AS tipo_operacion_codigo,
    a.nombre AS aseguradora,
    a.ans_horas_limite,
    u.full_name AS usuario_nombre,
    p.cumple_ans,
    p.probabilidad_riesgo,
    p.nivel_riesgo,
    p.created_at AS prediccion_fecha
FROM solicitudes s
LEFT JOIN tipos_operacion to_name ON s.tipo_operacion_id = to_name.id
LEFT JOIN aseguradoras a ON s.aseguradora_id = a.id
LEFT JOIN users u ON s.usuario_id = u.id
LEFT JOIN predicciones_ans p ON s.id = p.solicitud_id;

-- VIEW: Dashboard stats
CREATE OR REPLACE VIEW v_dashboard_stats AS
SELECT
    COUNT(*) AS total_solicitudes,
    COUNT(*) FILTER (WHERE p.cumple_ans = true) AS dentro_ans,
    COUNT(*) FILTER (WHERE p.cumple_ans = false) AS fuera_ans,
    COUNT(*) FILTER (WHERE p.nivel_riesgo = 'critico') AS criticos,
    COUNT(*) FILTER (WHERE p.nivel_riesgo = 'alto') AS alto_riesgo,
    ROUND(AVG(p.probabilidad_riesgo)::numeric, 3) AS promedio_riesgo,
    COUNT(*) FILTER (WHERE s.estado = 'pendiente') AS pendientes,
    COUNT(*) FILTER (WHERE s.estado = 'vencido') AS vencidos
FROM solicitudes s
LEFT JOIN predicciones_ans p ON s.id = p.solicitud_id;

COMMENT ON TABLE solicitudes IS 'Registro de solicitudes de clientes para gestión ANS';
COMMENT ON TABLE predicciones_ans IS 'Predicciones del modelo ML sobre cumplimiento de ANS';
COMMENT ON TABLE alertas IS 'Alertas generadas para solicitudes de alto riesgo';
