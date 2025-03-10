
-- First, ensure that the 'documents' bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documents', 'documents', TRUE, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

-- Then, create a policy for anonymous public access
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES ('allow-public-read-documents', 'documents', 'SELECT', '{"bucket_id":"documents","role":"anon","condition":"true"}'::jsonb)
ON CONFLICT (bucket_id, name) DO NOTHING;

-- Also create insert, update and delete policies for authenticated users
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES ('allow-auth-insert-documents', 'documents', 'INSERT', '{"bucket_id":"documents","role":"authenticated","condition":"true"}'::jsonb)
ON CONFLICT (bucket_id, name) DO NOTHING;

INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES ('allow-auth-update-documents', 'documents', 'UPDATE', '{"bucket_id":"documents","role":"authenticated","condition":"true"}'::jsonb)
ON CONFLICT (bucket_id, name) DO NOTHING;

INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES ('allow-auth-delete-documents', 'documents', 'DELETE', '{"bucket_id":"documents","role":"authenticated","condition":"true"}'::jsonb)
ON CONFLICT (bucket_id, name) DO NOTHING;

-- Also create policies for the service role
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES ('allow-service-all-documents', 'documents', 'ALL', '{"bucket_id":"documents","role":"service_role","condition":"true"}'::jsonb)
ON CONFLICT (bucket_id, name) DO NOTHING;

-- Create anonymous user policies for ALL operations to ensure full public access
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES ('allow-anon-insert-documents', 'documents', 'INSERT', '{"bucket_id":"documents","role":"anon","condition":"true"}'::jsonb)
ON CONFLICT (bucket_id, name) DO NOTHING;

INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES ('allow-anon-update-documents', 'documents', 'UPDATE', '{"bucket_id":"documents","role":"anon","condition":"true"}'::jsonb)
ON CONFLICT (bucket_id, name) DO NOTHING;

INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES ('allow-anon-delete-documents', 'documents', 'DELETE', '{"bucket_id":"documents","role":"anon","condition":"true"}'::jsonb)
ON CONFLICT (bucket_id, name) DO NOTHING;
