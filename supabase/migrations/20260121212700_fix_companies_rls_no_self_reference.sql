/*
  # Fix Companies RLS - Remove ALL Self-References

  ## Problem
  - Policy "Attendants can view company data" causes infinite recursion
  - Uses `companies.id` inside companies policy → circular reference
  - Error: "infinite recursion detected in policy for relation companies"

  ## Root Cause
  - ANY reference to companies table columns (like companies.id) inside companies policies causes recursion
  - Postgres cannot evaluate the policy without checking the policy itself

  ## Solution
  - Drop ALL existing policies from companies table
  - Create ONLY minimal policies that do NOT reference companies table at all
  - Use ONLY:
    - super_admins table for admin checks
    - auth.uid() for direct ownership
  - REMOVE attendants policy completely from companies table
  - Attendants will access company data through:
    - Edge functions with service role
    - Or SECURITY DEFINER functions

  ## New Policies (Safe)
  1. Super admins can do everything (via super_admins table)
  2. Companies can access their own data (via user_id = auth.uid())
  3. NO policy for attendants on companies table (prevents recursion)

  ## Security Model
  - Super admins: Full access via super_admins table lookup
  - Companies: Only their own data via user_id match
  - Attendants: Must use edge functions or security definer functions
*/

-- ====================================
-- STEP 1: Drop ALL existing policies
-- ====================================

DROP POLICY IF EXISTS "Super admins can delete companies" ON companies;
DROP POLICY IF EXISTS "Super admins can insert companies" ON companies;
DROP POLICY IF EXISTS "Attendants can view company data" ON companies;
DROP POLICY IF EXISTS "Companies can view own data" ON companies;
DROP POLICY IF EXISTS "Super admins can view all companies" ON companies;
DROP POLICY IF EXISTS "Companies can update own data" ON companies;
DROP POLICY IF EXISTS "Super admins can update companies" ON companies;

-- ====================================
-- STEP 2: Create NEW minimal policies
-- (NO self-references to companies)
-- ====================================

-- SELECT: Super admins can view all companies
CREATE POLICY "super_admins_select_all"
  ON companies
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM super_admins
      WHERE super_admins.user_id = auth.uid()
    )
  );

-- SELECT: Companies can view only their own data
CREATE POLICY "companies_select_own"
  ON companies
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT: Only super admins can create companies
CREATE POLICY "super_admins_insert"
  ON companies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM super_admins
      WHERE super_admins.user_id = auth.uid()
    )
  );

-- UPDATE: Super admins can update any company
CREATE POLICY "super_admins_update_all"
  ON companies
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM super_admins
      WHERE super_admins.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM super_admins
      WHERE super_admins.user_id = auth.uid()
    )
  );

-- UPDATE: Companies can update only their own data
CREATE POLICY "companies_update_own"
  ON companies
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: Only super admins can delete companies
CREATE POLICY "super_admins_delete"
  ON companies
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM super_admins
      WHERE super_admins.user_id = auth.uid()
    )
  );

-- ====================================
-- STEP 3: Create helper function for attendants
-- (SECURITY DEFINER bypasses RLS)
-- ====================================

CREATE OR REPLACE FUNCTION get_attendant_company()
RETURNS TABLE (
  id uuid,
  api_key text,
  name text,
  phone_number text,
  email text,
  user_id uuid,
  is_super_admin boolean,
  created_at timestamptz,
  max_attendants integer,
  payment_notification_day integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Get the company for the current attendant
  RETURN QUERY
  SELECT 
    c.id,
    c.api_key,
    c.name,
    c.phone_number,
    c.email,
    c.user_id,
    c.is_super_admin,
    c.created_at,
    c.max_attendants,
    c.payment_notification_day
  FROM companies c
  INNER JOIN attendants a ON a.company_id = c.id
  WHERE a.user_id = auth.uid();
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_attendant_company() TO authenticated;
