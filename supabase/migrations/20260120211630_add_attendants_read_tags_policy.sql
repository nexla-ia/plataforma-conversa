/*
  # Add attendants read tags policy

  1. Changes
    - Add policy to allow attendants to read tags from their company
  
  2. Security
    - Attendants can only read tags from their own company
*/

-- Add policy for attendants to read tags
CREATE POLICY "Attendants can view tags from their company"
  ON tags FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM attendants WHERE user_id = auth.uid()
    )
  );