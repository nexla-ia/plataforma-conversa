/*
  # Fix Attendants Policies and Functions

  ## Problem
  - Function `is_super_admin()` checks wrong table (companies instead of super_admins)
  - This causes attendant creation to fail
  - Policies using this function will fail

  ## Solution
  1. Fix `is_super_admin()` function to check `super_admins` table
  2. Keep existing policies (they use SECURITY DEFINER functions)
  
  ## Security
  - SECURITY DEFINER functions bypass RLS safely
  - Super admins verified via super_admins table
  - Companies verified via user_id match
*/

-- Fix is_super_admin function to check super_admins table
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM super_admins
    WHERE super_admins.user_id = auth.uid()
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION user_owns_company(uuid) TO authenticated;
