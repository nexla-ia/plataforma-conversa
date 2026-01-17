/*
  # Add policy for attendants to read sectors

  1. Changes
    - Add new RLS policy on sectors table
    - Allows attendants to read sectors from their company
  
  2. Security
    - Attendants can only read sectors from their assigned company
    - Uses company_id from attendants table to verify relationship
*/

CREATE POLICY "Attendants can read company sectors"
  ON sectors
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM attendants 
      WHERE user_id = auth.uid()
    )
  );
