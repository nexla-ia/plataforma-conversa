/*
  # Clean Attendants Duplicate Policies and Add API Key Column

  1. Problem
    - Multiple duplicate RLS policies on attendants table
    - No direct api_key field for quick access to company's API key
  
  2. Changes
    - Drop all duplicate policies
    - Keep only one set of policies for each operation
    - Add api_key column that automatically copies from company
    - Add trigger to auto-populate api_key on insert/update
  
  3. Security
    - Company admins can only manage their own company attendants
    - Super admins can manage all attendants
    - Attendants can view/update their own profile
*/

-- Drop all duplicate policies
DROP POLICY IF EXISTS "Companies can view own attendants" ON attendants;
DROP POLICY IF EXISTS "Companies can insert own attendants" ON attendants;
DROP POLICY IF EXISTS "Companies can update own attendants" ON attendants;
DROP POLICY IF EXISTS "Companies can delete own attendants" ON attendants;

-- Add api_key column to attendants table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendants' AND column_name = 'api_key'
  ) THEN
    ALTER TABLE attendants ADD COLUMN api_key text;
  END IF;
END $$;

-- Create function to auto-populate api_key from company
CREATE OR REPLACE FUNCTION sync_attendant_api_key()
RETURNS TRIGGER AS $$
BEGIN
  SELECT api_key INTO NEW.api_key
  FROM companies
  WHERE id = NEW.company_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS sync_attendant_api_key_trigger ON attendants;

CREATE TRIGGER sync_attendant_api_key_trigger
  BEFORE INSERT OR UPDATE OF company_id
  ON attendants
  FOR EACH ROW
  EXECUTE FUNCTION sync_attendant_api_key();

-- Update existing records to have api_key
UPDATE attendants a
SET api_key = c.api_key
FROM companies c
WHERE a.company_id = c.id
  AND a.api_key IS NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_attendants_api_key ON attendants(api_key);
CREATE INDEX IF NOT EXISTS idx_attendants_company_id ON attendants(company_id);