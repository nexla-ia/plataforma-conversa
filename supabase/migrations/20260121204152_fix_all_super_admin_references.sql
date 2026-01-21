/*
  # Fix All Super Admin References in RLS Policies

  1. Changes
    - Replace all RLS policies that reference the `super_admins` table
    - Use `companies.is_super_admin = true` instead
    - This affects policies in: companies, attendants, departments, sectors, tags, notifications

  2. Security
    - Maintains same security level
    - Super admins are now identified by the `is_super_admin` column in companies table
*/

-- Drop and recreate policies for COMPANIES table
DROP POLICY IF EXISTS "Super admins insert companies" ON companies;
DROP POLICY IF EXISTS "Super admins read all companies" ON companies;
DROP POLICY IF EXISTS "Super admins update companies" ON companies;

CREATE POLICY "Super admins insert companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Super admins read all companies"
  ON companies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Super admins update companies"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
  );

-- Drop and recreate policies for ATTENDANTS table
DROP POLICY IF EXISTS "Super admins read all attendants" ON attendants;
DROP POLICY IF EXISTS "Super admins update attendants" ON attendants;
DROP POLICY IF EXISTS "Super admins delete attendants" ON attendants;

CREATE POLICY "Super admins read all attendants"
  ON attendants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Super admins update attendants"
  ON attendants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Super admins delete attendants"
  ON attendants FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
  );

-- Drop and recreate policies for DEPARTMENTS table
DROP POLICY IF EXISTS "Super admins can view all departments" ON departments;

CREATE POLICY "Super admins can view all departments"
  ON departments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
  );

-- Drop and recreate policies for SECTORS table
DROP POLICY IF EXISTS "Super admins can view all sectors" ON sectors;

CREATE POLICY "Super admins can view all sectors"
  ON sectors FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
  );

-- Drop and recreate policies for TAGS table
DROP POLICY IF EXISTS "Super admins can view all tags" ON tags;

CREATE POLICY "Super admins can view all tags"
  ON tags FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
  );
