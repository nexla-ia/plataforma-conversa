/*
  # Add attendants policies for contact_tags table

  1. Changes
    - Add policy to allow attendants to insert contact tags for their company contacts
    - Add policy to allow attendants to delete contact tags from their company contacts
  
  2. Security
    - Attendants can only manage tags for contacts that belong to their company
*/

-- Policy for attendants to insert contact tags for their company contacts
CREATE POLICY "Attendants can insert company contact tags"
  ON contact_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (
    contact_id IN (
      SELECT id FROM contacts
      WHERE company_id IN (
        SELECT company_id FROM attendants
        WHERE user_id = auth.uid()
      )
    )
  );

-- Policy for attendants to delete contact tags from their company contacts
CREATE POLICY "Attendants can delete company contact tags"
  ON contact_tags
  FOR DELETE
  TO authenticated
  USING (
    contact_id IN (
      SELECT id FROM contacts
      WHERE company_id IN (
        SELECT company_id FROM attendants
        WHERE user_id = auth.uid()
      )
    )
  );