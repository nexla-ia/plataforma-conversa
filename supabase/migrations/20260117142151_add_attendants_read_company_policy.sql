/*
  # Add policy for attendants to read their company data

  1. Changes
    - Add new RLS policy on companies table
    - Allows attendants to read data from their assigned company
  
  2. Security
    - Attendants can only read company data they belong to
    - Uses company_id from attendants table to verify relationship
*/

CREATE POLICY "Attendants can read their company data"
  ON companies
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT company_id 
      FROM attendants 
      WHERE user_id = auth.uid()
    )
  );
