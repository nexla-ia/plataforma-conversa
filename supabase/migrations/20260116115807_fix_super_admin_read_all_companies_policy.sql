/*
  # Fix Super Admin Read All Companies Policy

  1. Changes
    - Drop the incorrect "Super admins read all companies" policy
    - Create a corrected version that checks if the LOGGED-IN user is a super admin
    - This will allow super admins to see ALL companies, not just companies owned by super admins
  
  2. Security
    - Super admins (checked via auth.uid() in super_admins table) can read ALL companies
    - Regular company users can only read their own company data
*/

DROP POLICY IF EXISTS "Super admins read all companies" ON companies;

CREATE POLICY "Super admins read all companies"
  ON companies
  FOR SELECT
  TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM super_admins));
