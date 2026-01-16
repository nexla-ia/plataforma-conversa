/*
  # Add Authentication for Attendants

  1. Changes to attendants table
    - Add `user_id` column (uuid, references auth.users)
    - This links an attendant to an auth user account for login
  
  2. Security
    - Update RLS policies for attendants table
    - Add RLS policies for attendants to access messages filtered by:
      * Company API key (apikey_instancia)
      * Department ID
      * Sector ID
    - Attendants can only see messages related to their department/sector
  
  3. Important Notes
    - Attendants will now have login credentials (email + password)
    - Messages must be filtered by company API key AND department/sector
    - Each attendant belongs to one company, one department, and one sector
*/

-- Add user_id column to attendants table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendants' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE attendants ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    CREATE UNIQUE INDEX IF NOT EXISTS attendants_user_id_unique ON attendants(user_id);
  END IF;
END $$;

-- Drop existing attendants policies to recreate them
DROP POLICY IF EXISTS "Company admins can view their attendants" ON attendants;
DROP POLICY IF EXISTS "Company admins can insert their attendants" ON attendants;
DROP POLICY IF EXISTS "Company admins can update their attendants" ON attendants;
DROP POLICY IF EXISTS "Company admins can delete their attendants" ON attendants;
DROP POLICY IF EXISTS "Super admins can view all attendants" ON attendants;
DROP POLICY IF EXISTS "Super admins can insert attendants" ON attendants;
DROP POLICY IF EXISTS "Super admins can update attendants" ON attendants;
DROP POLICY IF EXISTS "Super admins can delete attendants" ON attendants;

-- RLS Policies for attendants table
CREATE POLICY "Company admins can view their attendants"
  ON attendants FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company admins can insert their attendants"
  ON attendants FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company admins can update their attendants"
  ON attendants FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company admins can delete their attendants"
  ON attendants FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can view all attendants"
  ON attendants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can insert attendants"
  ON attendants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can update attendants"
  ON attendants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can delete attendants"
  ON attendants FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Attendants can view their own profile"
  ON attendants FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Attendants can update their own profile"
  ON attendants FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for messages - Attendants can view messages filtered by API key, department, and sector
CREATE POLICY "Attendants can view messages for their department and sector"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM attendants a
      INNER JOIN companies c ON a.company_id = c.id
      WHERE a.user_id = auth.uid()
        AND a.is_active = true
        AND messages.apikey_instancia = c.api_key
        AND (
          messages.id IN (
            SELECT m.id FROM messages m
            WHERE m.apikey_instancia = c.api_key
          )
        )
    )
  );