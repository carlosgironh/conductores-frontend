-- Script para actualizar masivamente correos y contraseñas de conductores en Supabase
-- INSTRUCCIONES: Ejecutar este script directamente en el SQL Editor de Supabase (dashboard web).
-- Contraseñas: Panama*01, Panama*02, etc.

DO $$ 
DECLARE
    r RECORD;
    new_email TEXT;
    new_password TEXT;
    encrypted_pw TEXT;
    counter INT := 1;
    password_suffix TEXT;
BEGIN
    FOR r IN SELECT id, cedula, auth_user_id FROM public.conductores WHERE cedula IS NOT NULL AND cedula != '' ORDER BY id LOOP
        
        -- Formato del nuevo correo: <cedula>@roadto.com
        new_email := TRIM(r.cedula) || '@roadto.com';
        
        -- Formatear counter a 2 digitos, ej 01, 02
        password_suffix := lpad(counter::text, 2, '0');
        new_password := 'Panama*' || password_suffix;

        -- Encriptar la contraseña usando pgcrypto
        encrypted_pw := crypt(new_password, gen_salt('bf'));

        -- Actualizar en la tabla auth.users
        UPDATE auth.users 
        SET 
            email = new_email,
            encrypted_password = encrypted_pw,
            email_confirmed_at = now(),
            updated_at = now()
        WHERE id = r.auth_user_id;

        -- Actualizar también en la tabla conductores por consistencia
        UPDATE public.conductores
        SET email = new_email
        WHERE id = r.id;

        counter := counter + 1;
    END LOOP;
END $$;
