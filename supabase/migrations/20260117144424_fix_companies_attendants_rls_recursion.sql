/*
  # Fix RLS recursion between companies and attendants tables

  1. Problem
    - Recursion: companies policies query attendants, attendants policies query companies
    - This creates infinite loops causing 500 errors
  
  2. Solution
    - Drop problematic policies
    - Recreate without circular dependencies using SECURITY DEFINER functions
  
  3. Security
    - Maintain same access control without recursion
*/

-- Drop the problematic policy that causes recursion
DROP POLICY IF EXISTS "Attendants can read their company data" ON companies;

-- Create a security definer function to check if user is an attendant
CREATE OR REPLACE FUNCTION is_attendant_of_company(company_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM attendants
    WHERE attendants.company_id = company_uuid
    AND attendants.user_id = auth.uid()
  );
END;
$$;

-- Create a security definer function to get user's company_id as attendant
CREATE OR REPLACE FUNCTION get_attendant_company_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  company_uuid uuid;
BEGIN
  SELECT company_id INTO company_uuid
  FROM attendants
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  RETURN company_uuid;
END;
$$;

-- Recreate the attendant read policy using the security definer function
CREATE POLICY "Attendants can read their company data"
  ON companies
  FOR SELECT
  TO authenticated
  USING (is_attendant_of_company(id));

-- Drop and recreate company admin policies to use direct column comparison
DROP POLICY IF EXISTS "Company admins read own attendants" ON attendants;
DROP POLICY IF EXISTS "Company admins update own attendants" ON attendants;
DROP POLICY IF EXISTS "Company admins delete own attendants" ON attendants;
DROP POLICY IF EXISTS "Admins can insert attendants" ON attendants;

-- Create a security definer function to check if user owns a company
CREATE OR REPLACE FUNCTION user_owns_company(company_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM companies
    WHERE companies.id = company_uuid
    AND companies.user_id = auth.uid()
  );
END;
$$;

-- Create a security definer function to check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM super_admins
    WHERE super_admins.user_id = auth.uid()
  );
END;
$$;

-- Recreate attendants policies using security definer functions
CREATE POLICY "Company admins read own attendants"
  ON attendants
  FOR SELECT
  TO authenticated
  USING (user_owns_company(company_id));

CREATE POLICY "Company admins update own attendants"
  ON attendants
  FOR UPDATE
  TO authenticated
  USING (user_owns_company(company_id))
  WITH CHECK (user_owns_company(company_id));

CREATE POLICY "Company admins delete own attendants"
  ON attendants
  FOR DELETE
  TO authenticated
  USING (user_owns_company(company_id));

CREATE POLICY "Admins can insert attendants"
  ON attendants
  FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin() OR user_owns_company(company_id));
