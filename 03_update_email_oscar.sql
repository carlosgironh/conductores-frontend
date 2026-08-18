-- Script para actualizar el correo de un conductor específico
-- Cédula: 3-708-1777
-- Correo anterior: pendienteporactualizar@roadto.com
-- Nuevo correo: Brownoscar460@gmail.com

DO $$ 
DECLARE
    target_cedula TEXT := '3-708-1777';
    old_email TEXT := 'pendienteporactualizar@roadto.com';
    new_email TEXT := 'Brownoscar460@gmail.com';
    user_auth_id UUID;
BEGIN
    -- 1. Obtener el auth_user_id desde la tabla conductores
    SELECT auth_user_id INTO user_auth_id 
    FROM public.conductores 
    WHERE cedula = target_cedula;

    IF user_auth_id IS NOT NULL THEN
        -- 2. Actualizar en la tabla auth.users
        UPDATE auth.users 
        SET 
            email = new_email,
            email_confirmed_at = now(),
            updated_at = now()
        WHERE id = user_auth_id;

        -- 3. Actualizar en la tabla public.conductores
        UPDATE public.conductores
        SET email = new_email
        WHERE cedula = target_cedula;
        
        RAISE NOTICE 'Correo actualizado exitosamente a % para la cédula %', new_email, target_cedula;
    ELSE
        RAISE NOTICE 'No se encontró un conductor con la cédula %', target_cedula;
    END IF;
END $$;
