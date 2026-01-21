/*
  # Add Notifications System and Payment Day

  ## 1. New Columns
    - `companies.payment_notification_day` (integer)
      - Day of month (1-31) when payment notification should appear
      - Default: 5 (5th day of the month)
      - NULL means no payment notifications

  ## 2. New Tables
    - `notifications`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `title` (text, notification title)
      - `message` (text, notification message)
      - `type` (text, notification type: 'payment', 'info', 'warning', 'error')
      - `is_read` (boolean, default false)
      - `created_at` (timestamptz, default now())

  ## 3. Security
    - Enable RLS on `notifications` table
    - Companies can read their own notifications
    - Companies can update their own notifications (mark as read)
    - Super admins can create notifications for any company
    - Super admins can read all notifications
*/

-- Add payment_notification_day column to companies
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS payment_notification_day integer DEFAULT 5 CHECK (payment_notification_day >= 1 AND payment_notification_day <= 31);

COMMENT ON COLUMN companies.payment_notification_day IS 'Day of month (1-31) when payment notification should appear';

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info' CHECK (type IN ('payment', 'info', 'warning', 'error')),
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Companies can read their own notifications
CREATE POLICY "Companies can read own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

-- Policy: Companies can update their own notifications (mark as read)
CREATE POLICY "Companies can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

-- Policy: Super admins can create notifications for any company
CREATE POLICY "Super admins can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies
      WHERE user_id = auth.uid()
      AND is_super_admin = true
    )
  );

-- Policy: Super admins can read all notifications
CREATE POLICY "Super admins can read all notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE user_id = auth.uid()
      AND is_super_admin = true
    )
  );

-- Policy: Super admins can update all notifications
CREATE POLICY "Super admins can update all notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE user_id = auth.uid()
      AND is_super_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies
      WHERE user_id = auth.uid()
      AND is_super_admin = true
    )
  );

-- Policy: Super admins can delete all notifications
CREATE POLICY "Super admins can delete notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE user_id = auth.uid()
      AND is_super_admin = true
    )
  );

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_notifications_company_id ON notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
