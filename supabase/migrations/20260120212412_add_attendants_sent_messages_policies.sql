/*
  # Add attendants policies for sent_messages

  1. Changes
    - Add policy to allow attendants to insert sent messages
    - Add policy to allow attendants to view sent messages from their company
  
  2. Security
    - Attendants can only insert sent messages for their own company
    - Attendants can only view sent messages from their company
*/

-- Policy for attendants to view sent messages from their company
CREATE POLICY "Attendants can view company sent messages"
  ON sent_messages
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM attendants WHERE user_id = auth.uid()
    )
  );

-- Policy for attendants to insert sent messages for their company
CREATE POLICY "Attendants can insert company sent messages"
  ON sent_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM attendants WHERE user_id = auth.uid()
    )
  );