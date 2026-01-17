/*
  # Fix delete company cascade to include auth user

  1. Changes
    - Update delete_company_cascade function to also delete the auth user
    - This ensures complete cleanup when deleting a company
  
  2. Security
    - Only super admins can execute this function
    - Deletes user from auth.users table
*/

-- Drop the old function
DROP FUNCTION IF EXISTS delete_company_cascade(uuid);

-- Create updated function that also deletes auth user
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
  company_user_id uuid;
  deleted_attendant_users int := 0;
BEGIN
  -- Check if user is super admin
  IF NOT EXISTS (
    SELECT 1 FROM super_admins
    WHERE super_admins.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only super admins can delete companies';
  END IF;

  -- Get company data before deletion
  SELECT api_key, user_id INTO company_api_key, company_user_id
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

  -- Delete auth users for all attendants of this company
  IF deleted_attendants > 0 THEN
    DELETE FROM auth.users
    WHERE id IN (
      SELECT user_id FROM attendants WHERE company_id = company_uuid AND user_id IS NOT NULL
    );
    
    GET DIAGNOSTICS deleted_attendant_users = ROW_COUNT;
  END IF;

  -- Delete the company (CASCADE will handle related records)
  DELETE FROM companies WHERE id = company_uuid;

  -- Delete the company's auth user if it exists
  IF company_user_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = company_user_id;
  END IF;

  -- Return statistics
  RETURN jsonb_build_object(
    'success', true,
    'deleted', jsonb_build_object(
      'attendants', deleted_attendants,
      'attendant_users', deleted_attendant_users,
      'departments', deleted_departments,
      'sectors', deleted_sectors,
      'tags', deleted_tags,
      'messages', deleted_messages,
      'sent_messages', deleted_sent_messages,
      'company_user', CASE WHEN company_user_id IS NOT NULL THEN 1 ELSE 0 END
    )
  );
END;
$$;

-- Grant execute permission to authenticated users (function checks super admin internally)
GRANT EXECUTE ON FUNCTION delete_company_cascade(uuid) TO authenticated;
