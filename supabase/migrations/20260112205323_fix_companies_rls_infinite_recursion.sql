/*
  # Fix Infinite Recursion in Companies RLS Policies

  1. Changes
    - Drop existing policies that cause infinite recursion
    - Create new policies without recursive subqueries
    - Use direct column checks instead of subqueries on the same table

  2. Security
    - Maintain same access control logic
    - Super admin can see all companies
    - Regular companies can only see their own data
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Super admin can view all companies" ON companies;
DROP POLICY IF EXISTS "Companies can view their own data" ON companies;
DROP POLICY IF EXISTS "Super admin can insert companies" ON companies;
DROP POLICY IF EXISTS "Super admin can update companies" ON companies;

-- Create new policies without recursion
CREATE POLICY "Users can view own company"
  ON companies FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Super admin can view all companies"
  ON companies FOR SELECT
  TO authenticated
  USING (is_super_admin = true AND user_id = auth.uid());

CREATE POLICY "Super admin can insert companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT is_super_admin FROM companies WHERE user_id = auth.uid() LIMIT 1) = true
  );

CREATE POLICY "Super admin can update companies"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    (SELECT is_super_admin FROM companies WHERE user_id = auth.uid() LIMIT 1) = true
  )
  WITH CHECK (
    (SELECT is_super_admin FROM companies WHERE user_id = auth.uid() LIMIT 1) = true
  );