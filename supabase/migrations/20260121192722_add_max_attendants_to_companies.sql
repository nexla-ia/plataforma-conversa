/*
  # Add max_attendants field to companies table

  1. Changes
    - Add `max_attendants` column to `companies` table
      - Type: integer
      - Default: 5
      - Not null
    - This field limits how many attendants a company can have

  2. Notes
    - Existing companies will automatically get the default value of 5
    - Super admins can modify this limit when creating/editing companies
*/

-- Add max_attendants column to companies table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'max_attendants'
  ) THEN
    ALTER TABLE companies ADD COLUMN max_attendants integer NOT NULL DEFAULT 5;
  END IF;
END $$;