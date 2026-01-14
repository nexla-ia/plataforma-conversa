/*
  # Change Company ID to API Key

  1. Changes
    - Drop existing foreign key constraints
    - Remove old id column from companies table
    - Make api_key the primary key
    - Update messages table to reference api_key
    - Recreate all policies with new structure

  2. Security
    - Maintain all RLS policies with updated references
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Companies can view their own messages" ON messages;
DROP POLICY IF EXISTS "Super admin can view all messages" ON messages;
DROP POLICY IF EXISTS "Webhook can insert messages with valid api key" ON messages;
DROP POLICY IF EXISTS "Anonymous webhook can insert messages" ON messages;

DROP POLICY IF EXISTS "Super admin can view all companies" ON companies;
DROP POLICY IF EXISTS "Companies can view their own data" ON companies;
DROP POLICY IF EXISTS "Super admin can insert companies" ON companies;
DROP POLICY IF EXISTS "Super admin can update companies" ON companies;

-- Drop existing constraints and indexes
DROP INDEX IF EXISTS idx_messages_company_id;
DROP INDEX IF EXISTS idx_companies_user_id;
DROP INDEX IF EXISTS idx_companies_api_key;

-- Alter messages table to remove foreign key
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_company_id_fkey;

-- Drop the old id column and recreate companies table structure
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_pkey;
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_api_key_key;
ALTER TABLE companies DROP COLUMN IF EXISTS id CASCADE;

-- Make api_key the primary key
ALTER TABLE companies ADD PRIMARY KEY (api_key);

-- Update messages table: remove old company_id if it exists and use apikey_instancia
ALTER TABLE messages DROP COLUMN IF EXISTS company_id;

-- Create new index for messages
CREATE INDEX IF NOT EXISTS idx_messages_apikey ON messages(apikey_instancia);
CREATE INDEX IF NOT EXISTS idx_companies_user_id ON companies(user_id);

-- Recreate Companies policies
CREATE POLICY "Super admin can view all companies"
  ON companies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.user_id = auth.uid() AND c.is_super_admin = true
    )
  );

CREATE POLICY "Companies can view their own data"
  ON companies FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Super admin can insert companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.user_id = auth.uid() AND c.is_super_admin = true
    )
  );

CREATE POLICY "Super admin can update companies"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.user_id = auth.uid() AND c.is_super_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.user_id = auth.uid() AND c.is_super_admin = true
    )
  );

-- Recreate Messages policies
CREATE POLICY "Companies can view their own messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    apikey_instancia IN (
      SELECT api_key FROM companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Super admin can view all messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.user_id = auth.uid() AND c.is_super_admin = true
    )
  );

CREATE POLICY "Webhook can insert messages with valid api key"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    apikey_instancia IN (SELECT api_key FROM companies)
  );

CREATE POLICY "Anonymous webhook can insert messages"
  ON messages FOR INSERT
  TO anon
  WITH CHECK (true);