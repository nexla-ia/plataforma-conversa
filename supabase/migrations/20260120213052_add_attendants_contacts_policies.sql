/*
  # Add attendants policies for contacts table

  1. Changes
    - Add policy to allow attendants to insert contacts for their company
    - Add policy to allow attendants to update contacts from their company
  
  2. Security
    - Attendants can only insert contacts for their own company
    - Attendants can only update contacts from their company
*/

-- Policy for attendants to insert contacts for their company
CREATE POLICY "Attendants can insert company contacts"
  ON contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM attendants WHERE user_id = auth.uid()
    )
  );

-- Policy for attendants to update contacts from their company
CREATE POLICY "Attendants can update company contacts"
  ON contacts
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM attendants WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM attendants WHERE user_id = auth.uid()
    )
  );