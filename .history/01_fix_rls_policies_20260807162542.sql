-- 1. Asegurar que las tablas tengan Row Level Security activada
ALTER TABLE conductores ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE coordinadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE viajes_reservados ENABLE ROW LEVEL SECURITY;
ALTER TABLE lista_espera_zonas ENABLE ROW LEVEL SECURITY;
ALTER TABLE zonas_geofence ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;

-- 2. Limpiar TODAS las políticas existentes para evitar conflictos
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END
$$;

-- 3. Crear Funciones Auxiliares de Seguridad (Seguras y rápidas) en schema public
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_coordinador()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.coordinadores WHERE auth_user_id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. POLÍTICAS PARA ADMINISTRADORES (Poder absoluto)
CREATE POLICY "Admins full access conductores" ON conductores FOR ALL TO public USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins full access admins" ON admins FOR ALL TO public USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins full access coordinadores" ON coordinadores FOR ALL TO public USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins full access passengers" ON passengers FOR ALL TO public USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins full access viajes" ON viajes_reservados FOR ALL TO public USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins full access lista_espera" ON lista_espera_zonas FOR ALL TO public USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins full access zonas" ON zonas_geofence FOR ALL TO public USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins full access pagos" ON pagos FOR ALL TO public USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins full access documentos" ON documentos FOR ALL TO public USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 5. POLÍTICAS PARA COORDINADORES
CREATE POLICY "Coordinadores leen conductores" ON conductores FOR SELECT TO authenticated USING (public.is_coordinador());
CREATE POLICY "Coordinadores actualizan conductores" ON conductores FOR UPDATE TO authenticated USING (public.is_coordinador()) WITH CHECK (public.is_coordinador());
CREATE POLICY "Coordinadores leen pasajeros" ON passengers FOR SELECT TO authenticated USING (public.is_coordinador());
CREATE POLICY "Coordinadores leen viajes" ON viajes_reservados FOR SELECT TO authenticated USING (public.is_coordinador());
CREATE POLICY "Coordinadores actualizan viajes" ON viajes_reservados FOR UPDATE TO authenticated USING (public.is_coordinador()) WITH CHECK (public.is_coordinador());
CREATE POLICY "Coordinadores leen lista espera" ON lista_espera_zonas FOR SELECT TO authenticated USING (public.is_coordinador());
CREATE POLICY "Coordinadores actualizan lista espera" ON lista_espera_zonas FOR UPDATE TO authenticated USING (public.is_coordinador()) WITH CHECK (public.is_coordinador());

-- 6. POLÍTICAS PARA CONDUCTORES
CREATE POLICY "Permitir insert en conductores a todos" ON conductores FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Conductores leen propio registro" ON conductores FOR SELECT TO authenticated USING (conductores.auth_user_id = auth.uid());
CREATE POLICY "Conductores actualizan propio registro" ON conductores FOR UPDATE TO authenticated USING (conductores.auth_user_id = auth.uid()) WITH CHECK (conductores.auth_user_id = auth.uid());
CREATE POLICY "Conductores leen sus documentos" ON documentos FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.conductores WHERE conductores.id = documentos.conductor_id AND conductores.auth_user_id = auth.uid()));
CREATE POLICY "Conductores insertan sus documentos" ON documentos FOR INSERT TO authenticated WITH CHECK (true); 
CREATE POLICY "Conductores actualizan sus documentos" ON documentos FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.conductores WHERE conductores.id = documentos.conductor_id AND conductores.auth_user_id = auth.uid()));
CREATE POLICY "Conductores leen sus pagos" ON pagos FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.conductores WHERE conductores.id = pagos.conductor_id AND conductores.auth_user_id = auth.uid()));
CREATE POLICY "Conductores insertan sus pagos" ON pagos FOR INSERT TO authenticated WITH CHECK (true);

-- 7. POLÍTICAS PARA PASAJEROS
CREATE POLICY "Pasajeros leen propio perfil" ON passengers FOR SELECT TO authenticated USING (passengers.id = auth.uid());
CREATE POLICY "Permitir insert en pasajeros a todos" ON passengers FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Pasajeros actualizan propio perfil" ON passengers FOR UPDATE TO authenticated USING (passengers.id = auth.uid());

-- 8. VIAJES Y ZONAS
CREATE POLICY "Auth leer viajes" ON viajes_reservados FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insertar viajes" ON viajes_reservados FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth actualizar viajes" ON viajes_reservados FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth eliminar viajes" ON viajes_reservados FOR DELETE TO authenticated USING (true);
CREATE POLICY "Todos leen zonas" ON zonas_geofence FOR SELECT TO public USING (true);
CREATE POLICY "Auth lee lista de espera" ON lista_espera_zonas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth inserta en lista de espera" ON lista_espera_zonas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth actualiza lista de espera" ON lista_espera_zonas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth elimina de lista de espera" ON lista_espera_zonas FOR DELETE TO authenticated USING (true);

-- 9. PERFIL PÚBLICO ANON
CREATE POLICY "Anon lee conductores" ON conductores FOR SELECT TO anon USING (true);
CREATE POLICY "Anon lee documentos" ON documentos FOR SELECT TO anon USING (true);
CREATE POLICY "Anon lee pagos" ON pagos FOR SELECT TO anon USING (true);
