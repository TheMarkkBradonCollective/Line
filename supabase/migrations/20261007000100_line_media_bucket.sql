-- Private bucket for uploaded photos, videos and reels.
-- No storage policies are added, so browsers cannot read or list it with the publishable key.
-- The server checks access first, then hands out a short-lived signed URL.
-- Uploads use one-time signed upload URLs that the server issues to the signed-in author.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'line-media',
      'line-media',
      false,
      52428800,
      array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
    )
    on conflict (id) do update
      set public = false,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;
  end if;
end;
$$;
