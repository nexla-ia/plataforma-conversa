/*
  # Fix infinite recursion in super_admins RLS

  1. Changes
    - Drop all existing policies on super_admins
    - Create single simple policy that allows users to check their own record only
    - This avoids infinite recursion

  2. Security
    - Users can only see their own super admin status
    - No recursive policy checks
*/

-- Drop all existing policies on super_admins
DROP POLICY IF EXISTS "Users can check own super admin status" ON super_admins;
DROP POLICY IF EXISTS "Super admins can see all super admins" ON super_admins;

-- Create single simple policy: users can only see their own record
CREATE POLICY "Users can read own super admin record"
  ON super_admins
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());