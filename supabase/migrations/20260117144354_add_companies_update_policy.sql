/*
  # Add UPDATE policy for company users

  1. Changes
    - Add policy for company users to update their own company data
  
  2. Security
    - Company users can only update their own company record
    - Policy checks that user_id matches auth.uid()
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'companies' 
    AND policyname = 'Company users update own data'
  ) THEN
    CREATE POLICY "Company users update own data"
      ON companies
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
