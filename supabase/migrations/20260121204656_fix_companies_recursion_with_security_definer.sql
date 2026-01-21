/*
  # Fix Companies Table Infinite Recursion

  1. Problem
    - Companies policies query companies table itself causing infinite recursion
    - "Super admins read all companies" policy tries to read companies to check if user is super admin
  
  2. Solution
    - Drop problematic super admin policies from companies table
    - Keep only direct ownership checks (user_id = auth.uid())
    - Super admins will use edge functions with service role for admin operations
    
  3. Security
    - Companies can only see their own data
    - Attendants can see their company data
    - Super admin operations handled via edge functions with proper authentication
*/

-- Drop all super admin policies from companies table to fix recursion
DROP POLICY IF EXISTS "Super admins insert companies" ON companies;
DROP POLICY IF EXISTS "Super admins read all companies" ON companies;
DROP POLICY IF EXISTS "Super admins update companies" ON companies;

-- Keep only the safe policies that don't cause recursion
-- These policies are safe because they check auth.uid() directly, not querying companies
-- Policy "Company users read own data" - KEEP (safe)
-- Policy "Attendants can read their company data" - KEEP (safe, queries attendants not companies)
-- Policy "Company users update own data" - KEEP (safe)

-- Super admins will manage companies through edge functions using service role
-- The edge functions already verify super admin status correctly
