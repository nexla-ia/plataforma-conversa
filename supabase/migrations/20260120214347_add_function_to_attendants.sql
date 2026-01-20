/*
  # Add function field to attendants table

  1. Changes
    - Add `function` column to attendants table to store the attendant's role/function
    - Default value is empty string for existing records
  
  2. Purpose
    - Allow attendants to have a role/function (e.g., "Vendedor", "Suporte", "Gerente")
    - This will be displayed when the attendant sends messages
*/

-- Add function column to attendants table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendants' AND column_name = 'function'
  ) THEN
    ALTER TABLE attendants ADD COLUMN function text DEFAULT '';
  END IF;
END $$;