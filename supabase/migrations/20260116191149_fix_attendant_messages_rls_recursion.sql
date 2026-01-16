/*
  # Fix Attendant Messages RLS Recursion

  1. Problem
    - The attendant policy for viewing messages had a subquery referencing the messages table itself
    - This caused infinite recursion: "infinite recursion detected in policy for relation messages"
  
  2. Solution
    - Simplify the policy to only check:
      * User is an active attendant
      * Message's apikey_instancia matches the attendant's company api_key
    - Remove the unnecessary subquery that caused recursion
  
  3. Security
    - Attendants can only see messages from their own company (via api_key match)
    - Attendants must be active (is_active = true)
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Attendants can view messages for their department and sector" ON messages;

-- Create simplified policy without recursion
CREATE POLICY "Attendants can view company messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM attendants a
      INNER JOIN companies c ON a.company_id = c.id
      WHERE a.user_id = auth.uid()
        AND a.is_active = true
        AND messages.apikey_instancia = c.api_key
    )
  );