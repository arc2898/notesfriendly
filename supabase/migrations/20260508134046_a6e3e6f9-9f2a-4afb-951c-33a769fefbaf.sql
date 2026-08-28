-- 1. user_preferences push columns
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS push_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS push_types jsonb NOT NULL DEFAULT '["message","post_reply","mention"]'::jsonb;

-- 2. posts image attachment
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS image_path text;

-- 3. Storage policies for posts/* prefix in chat-images bucket
CREATE POLICY "posts_images_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-images'
  AND (storage.foldername(name))[1] = 'posts'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "posts_images_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-images'
  AND (storage.foldername(name))[1] = 'posts'
);

CREATE POLICY "posts_images_delete_own"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-images'
  AND (storage.foldername(name))[1] = 'posts'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- 4. Analytics summary function
CREATE OR REPLACE FUNCTION public.analytics_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'god'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  WITH
    active_24h AS (SELECT COUNT(DISTINCT user_id) AS n FROM activity_logs WHERE created_at > now() - interval '24 hours'),
    active_7d  AS (SELECT COUNT(DISTINCT user_id) AS n FROM activity_logs WHERE created_at > now() - interval '7 days'),
    active_30d AS (SELECT COUNT(DISTINCT user_id) AS n FROM activity_logs WHERE created_at > now() - interval '30 days'),
    daily_messages AS (
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, COUNT(*) AS n
      FROM messages
      WHERE created_at > now() - interval '30 days' AND deleted_at IS NULL
      GROUP BY 1 ORDER BY 1
    ),
    top_posters AS (
      SELECT p.author_id, pr.name, COUNT(*) AS n
      FROM posts p LEFT JOIN profiles pr ON pr.id = p.author_id
      WHERE p.created_at > now() - interval '30 days'
      GROUP BY p.author_id, pr.name
      ORDER BY n DESC LIMIT 10
    ),
    storage_by_subject AS (
      SELECT subject_code, COALESCE(SUM(file_size), 0)::bigint AS bytes, COUNT(*) AS files
      FROM admin_files
      GROUP BY subject_code
      ORDER BY bytes DESC LIMIT 20
    ),
    total_counts AS (
      SELECT
        (SELECT COUNT(*) FROM profiles) AS users,
        (SELECT COUNT(*) FROM messages WHERE deleted_at IS NULL) AS messages,
        (SELECT COUNT(*) FROM posts) AS posts,
        (SELECT COUNT(*) FROM admin_files) AS files
    )
  SELECT jsonb_build_object(
    'active_users', jsonb_build_object(
      'd1', (SELECT n FROM active_24h),
      'd7', (SELECT n FROM active_7d),
      'd30', (SELECT n FROM active_30d)
    ),
    'daily_messages', COALESCE((SELECT jsonb_agg(jsonb_build_object('day', day, 'n', n)) FROM daily_messages), '[]'::jsonb),
    'top_posters', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', name, 'n', n)) FROM top_posters), '[]'::jsonb),
    'storage_by_subject', COALESCE((SELECT jsonb_agg(jsonb_build_object('subject', subject_code, 'bytes', bytes, 'files', files)) FROM storage_by_subject), '[]'::jsonb),
    'totals', (SELECT row_to_json(total_counts) FROM total_counts)
  ) INTO result;

  RETURN result;
END $$;