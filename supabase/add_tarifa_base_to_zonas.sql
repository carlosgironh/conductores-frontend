-- =====================================================================
-- MIGRACIÓN: Agregar tarifa_base a zonas_paradas
-- Fecha: 2026-08-21
-- Descripción: Permite definir el costo de carrera base desde/hasta
--              cada zona, útil para el cálculo automático de tarifas.
-- =====================================================================

-- Agregar columna tarifa_base a zonas_paradas (si no existe)
ALTER TABLE zonas_paradas
  ADD COLUMN IF NOT EXISTS tarifa_base DECIMAL(8,2) DEFAULT NULL;

-- Comentario en la columna
COMMENT ON COLUMN zonas_paradas.tarifa_base IS 'Tarifa base en dólares para carreras desde/hasta esta zona. NULL si no aplica tarifa directa.';

-- Actualizar zonas existentes con tarifas según las rutas de Trazabilidad
-- Puedes ejecutar estas líneas manualmente si ya tienes zonas creadas:
/*
UPDATE zonas_paradas SET tarifa_base = 1.00 WHERE nombre ILIKE '%Bique%';
UPDATE zonas_paradas SET tarifa_base = 1.50 WHERE nombre ILIKE '%Cerro Silvestre%';
UPDATE zonas_paradas SET tarifa_base = 1.50 WHERE nombre ILIKE '%Nvo Chorrillo%' OR nombre ILIKE '%Nuevo Chorrillo%';
UPDATE zonas_paradas SET tarifa_base = 1.50 WHERE nombre ILIKE '%Caceres%' OR nombre ILIKE '%Caceres%';
UPDATE zonas_paradas SET tarifa_base = 1.50 WHERE nombre ILIKE '%Burunga%';
UPDATE zonas_paradas SET tarifa_base = 2.00 WHERE nombre ILIKE '%La Esperanza%';
UPDATE zonas_paradas SET tarifa_base = 2.00 WHERE nombre ILIKE '%Perurena%';
UPDATE zonas_paradas SET tarifa_base = 2.00 WHERE nombre ILIKE '%Terpel%';
UPDATE zonas_paradas SET tarifa_base = 2.00 WHERE nombre ILIKE '%Arraijan%' OR nombre ILIKE '%Arraijan%';
*/
