/*
  # Fix Companies RLS Policies (No Recursion)

  ## Problem
  - Previous policies caused infinite recursion by querying companies table within companies policies
  - Error: "infinite recursion detected in policy for relation companies"

  ## Solution
  - Remove ALL existing policies from companies table
  - Create new policies that use super_admins table instead of companies
  - This breaks the circular reference and eliminates recursion

  ## New Policies
  1. SELECT policies:
     - Super admins can view all companies (via super_admins table)
     - Company users can view their own data (via user_id)
     - Attendants can view their company data (via attendants table)
  
  2. INSERT policy:
     - Only super admins can create companies (via super_admins table)
  
  3. UPDATE policy:
     - Super admins can update any company (via super_admins table)
     - Company users can update their own data (via user_id)
  
  4. DELETE policy:
     - Only super admins can delete companies (via super_admins table)

  ## Security
  - No circular references
  - No recursion
  - Maintains proper access control
*/

-- Drop ALL existing policies from companies table
DROP POLICY IF EXISTS "Attendants can read their company data" ON companies;
DROP POLICY IF EXISTS "Company users read own data" ON companies;
DROP POLICY IF EXISTS "Company users update own data" ON companies;

-- ====================================
-- SELECT POLICIES (Read Access)
-- ====================================

-- Super admins can view all companies
CREATE POLICY "Super admins can view all companies"
  ON companies
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.super_admins sa
      WHERE sa.user_id = auth.uid()
    )
  );

-- Company users can view their own data
CREATE POLICY "Companies can view own data"
  ON companies
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Attendants can view their company data
CREATE POLICY "Attendants can view company data"
  ON companies
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.attendants a
      WHERE a.company_id = companies.id
        AND a.user_id = auth.uid()
    )
  );

-- ====================================
-- INSERT POLICY (Create)
-- ====================================

CREATE POLICY "Super admins can insert companies"
  ON companies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.super_admins sa
      WHERE sa.user_id = auth.uid()
    )
  );

-- ====================================
-- UPDATE POLICIES (Modify)
-- ====================================

-- Super admins can update any company
CREATE POLICY "Super admins can update companies"
  ON companies
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.super_admins sa
      WHERE sa.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.super_admins sa
      WHERE sa.user_id = auth.uid()
    )
  );

-- Companies can update their own data
CREATE POLICY "Companies can update own data"
  ON companies
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ====================================
-- DELETE POLICY (Remove)
-- ====================================

CREATE POLICY "Super admins can delete companies"
  ON companies
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.super_admins sa
      WHERE sa.user_id = auth.uid()
    )
  );
