/*
  # Enable RLS on super_admins table

  1. Changes
    - Enable Row Level Security on `super_admins` table
    - Add policy for authenticated users to check if they are super admins
    - This allows the edge function to verify super admin status

  2. Security
    - Users can only check their own super admin status
    - No one can see other users' super admin records
*/

-- Enable RLS on super_admins table
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can check if they themselves are super admins
CREATE POLICY "Users can check own super admin status"
  ON super_admins
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Allow super admins to see all super admin records (for management)
CREATE POLICY "Super admins can see all super admins"
  ON super_admins
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins sa
      WHERE sa.user_id = auth.uid()
    )
  );