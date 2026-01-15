/*
  # Create Storage Bucket for Message Files

  1. Storage
    - Create `message-files` bucket for storing images, documents, and audio files
    - Set bucket to public for easy access to files
*/

-- Create storage bucket for message files
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-files', 'message-files', true)
ON CONFLICT (id) DO NOTHING;