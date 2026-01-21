/*
  # Fix Remaining Super Admin Policies

  1. Changes
    - Fix super admin policies for contacts, contact_tags, and message_tags tables
    - Replace super_admins table references with companies.is_super_admin checks

  2. Security
    - Maintains same security level
    - Uses correct table references
*/

-- Fix CONTACTS policies
DROP POLICY IF EXISTS "Super admins can view all contacts" ON contacts;

CREATE POLICY "Super admins can view all contacts"
  ON contacts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
  );

-- Fix CONTACT_TAGS policies
DROP POLICY IF EXISTS "Super admins can view all contact tags" ON contact_tags;

CREATE POLICY "Super admins can view all contact tags"
  ON contact_tags FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
  );

-- Fix MESSAGE_TAGS policies
DROP POLICY IF EXISTS "Super admins can view all message tags" ON message_tags;
DROP POLICY IF EXISTS "Super admins can manage all message tags" ON message_tags;

CREATE POLICY "Super admins can view all message tags"
  ON message_tags FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Super admins can manage all message tags"
  ON message_tags FOR ALL
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
