/*
  # Clean up duplicate policies on companies table

  1. Changes
    - Remove all existing policies on companies
    - Create clean, non-recursive policies for super admins and company users
    
  2. Security
    - Super admins can read and manage all companies
    - Company users can only read their own company data
    - Only super admins can create new companies
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Company can read own data" ON companies;
DROP POLICY IF EXISTS "Super admin can insert companies" ON companies;
DROP POLICY IF EXISTS "Super admin can read all companies" ON companies;
DROP POLICY IF EXISTS "Super admin can update companies" ON companies;
DROP POLICY IF EXISTS "companies_insert_super_admin" ON companies;
DROP POLICY IF EXISTS "companies_select" ON companies;
DROP POLICY IF EXISTS "companies_select_own" ON companies;

-- Policy: Company users can read their own company data
CREATE POLICY "Company users read own data"
  ON companies
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Super admins can read all companies (non-recursive check)
CREATE POLICY "Super admins read all companies"
  ON companies
  FOR SELECT
  TO authenticated
  USING (
    user_id IN (SELECT user_id FROM super_admins)
  );

-- Policy: Super admins can insert companies
CREATE POLICY "Super admins insert companies"
  ON companies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM super_admins)
  );

-- Policy: Super admins can update companies
CREATE POLICY "Super admins update companies"
  ON companies
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (SELECT user_id FROM super_admins)
  )
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM super_admins)
  );