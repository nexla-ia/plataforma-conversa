/*
  # Fix is_super_admin() Function

  1. Changes
    - Update is_super_admin() function to check companies.is_super_admin column
    - Remove dependency on non-existent super_admins table

  2. Security
    - Maintains same security checks
    - Uses correct table reference
*/

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM companies
    WHERE companies.user_id = auth.uid()
    AND companies.is_super_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
