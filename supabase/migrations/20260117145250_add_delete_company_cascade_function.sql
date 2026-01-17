/*
  # Add function to delete company with cascade

  1. Changes
    - Create a function that deletes a company and all related data
    - Returns statistics about what was deleted
  
  2. Security
    - Only super admins can execute this function
    - Function verifies permissions before deleting
*/

-- Function to delete company and all related data
CREATE OR REPLACE FUNCTION delete_company_cascade(company_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_attendants int;
  deleted_departments int;
  deleted_sectors int;
  deleted_tags int;
  deleted_messages int;
  deleted_sent_messages int;
  company_api_key text;
BEGIN
  -- Check if user is super admin
  IF NOT EXISTS (
    SELECT 1 FROM super_admins
    WHERE super_admins.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only super admins can delete companies';
  END IF;

  -- Get company API key before deletion
  SELECT api_key INTO company_api_key
  FROM companies
  WHERE id = company_uuid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found';
  END IF;

  -- Count records that will be deleted (for statistics)
  SELECT COUNT(*) INTO deleted_attendants FROM attendants WHERE company_id = company_uuid;
  SELECT COUNT(*) INTO deleted_departments FROM departments WHERE company_id = company_uuid;
  SELECT COUNT(*) INTO deleted_sectors FROM sectors WHERE company_id = company_uuid;
  SELECT COUNT(*) INTO deleted_tags FROM tags WHERE company_id = company_uuid;
  SELECT COUNT(*) INTO deleted_messages FROM messages WHERE apikey_instancia = company_api_key;
  SELECT COUNT(*) INTO deleted_sent_messages FROM sent_messages WHERE company_id = company_uuid;

  -- Delete the company (CASCADE will handle related records)
  DELETE FROM companies WHERE id = company_uuid;

  -- Return statistics
  RETURN jsonb_build_object(
    'success', true,
    'deleted', jsonb_build_object(
      'attendants', deleted_attendants,
      'departments', deleted_departments,
      'sectors', deleted_sectors,
      'tags', deleted_tags,
      'messages', deleted_messages,
      'sent_messages', deleted_sent_messages
    )
  );
END;
$$;

-- Grant execute permission to authenticated users (function checks super admin internally)
GRANT EXECUTE ON FUNCTION delete_company_cascade(uuid) TO authenticated;
