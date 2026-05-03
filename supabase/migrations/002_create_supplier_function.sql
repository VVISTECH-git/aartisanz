-- Run this in Supabase SQL Editor
-- This creates a secure function that admins can call to create supplier accounts

CREATE OR REPLACE FUNCTION create_supplier_user(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_whatsapp TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user_id UUID;
  result JSON;
BEGIN
  -- Check caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can create suppliers';
  END IF;

  -- Create the auth user
  new_user_id := (
    SELECT id FROM auth.users WHERE email = p_email
  );

  IF new_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'User with this email already exists';
  END IF;

  -- Insert into auth.users using Supabase's internal function
  INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at,
    role,
    aud
  ) VALUES (
    gen_random_uuid(),
    p_email,
    crypt(p_password, gen_salt('bf')),
    NOW(),
    jsonb_build_object('full_name', p_full_name, 'role', 'supplier'),
    NOW(),
    NOW(),
    'authenticated',
    'authenticated'
  )
  RETURNING id INTO new_user_id;

  -- Update the profile created by trigger
  UPDATE profiles SET
    full_name = p_full_name,
    phone = p_phone,
    whatsapp_number = p_whatsapp,
    role = 'supplier'
  WHERE id = new_user_id;

  result := json_build_object('user_id', new_user_id, 'email', p_email);
  RETURN result;
END;
$$;

-- Grant execute to authenticated users (admin check is inside the function)
GRANT EXECUTE ON FUNCTION create_supplier_user TO authenticated;
