

INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true) ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "allow_all_attachments" ON storage.objects FOR ALL USING (bucket_id = 'attachments') WITH CHECK (bucket_id = 'attachments');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 0b. Add missing columns to web_profiles
ALTER TABLE public.web_profiles ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE public.web_profiles ADD COLUMN IF NOT EXISTS status_presence TEXT DEFAULT 'online';
ALTER TABLE public.web_profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.web_profiles ADD COLUMN IF NOT EXISTS pronouns TEXT;
ALTER TABLE public.web_profiles ADD COLUMN IF NOT EXISTS display_name TEXT;

-- 1. Reports table
CREATE TABLE IF NOT EXISTS public.reports (
    id SERIAL PRIMARY KEY,
    report_id TEXT UNIQUE NOT NULL,
    title TEXT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    type TEXT NOT NULL,
    attachments JSONB,
    anonymous BOOLEAN DEFAULT FALSE,
    submitted_by_id TEXT NOT NULL,
    submitted_by_tag TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    server_id TEXT NOT NULL,
    reported_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS title TEXT;

-- 2. Likes System
CREATE TABLE IF NOT EXISTS public.thread_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id TEXT REFERENCES public.reports(report_id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(report_id, user_id)
);

-- 3. Comments System (enhanced with replies and editing)
CREATE TABLE IF NOT EXISTS public.thread_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id TEXT REFERENCES public.reports(report_id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    username TEXT,
    avatar_url TEXT,
    content TEXT NOT NULL,
    parent_id BIGINT,
    edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add columns if table already exists
ALTER TABLE public.thread_comments ADD COLUMN IF NOT EXISTS parent_id BIGINT;
ALTER TABLE public.thread_comments ADD COLUMN IF NOT EXISTS edited BOOLEAN DEFAULT FALSE;
ALTER TABLE public.thread_comments ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.thread_comments ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.thread_comments ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 4. Comment Likes
CREATE TABLE IF NOT EXISTS public.comment_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id BIGINT REFERENCES public.thread_comments(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(comment_id, user_id)
);

-- 5. Follower System
CREATE TABLE IF NOT EXISTS public.follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id TEXT NOT NULL,
    following_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(follower_id, following_id)
);

-- 6. Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    from_user_id TEXT,
    from_username TEXT,
    report_id TEXT,
    target_id TEXT,
    content TEXT,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add report_id column if missing
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS report_id TEXT;

-- 7. Reviews / Ratings
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(report_id, user_id)
);

-- 8. Action Logs (with before/after details)
CREATE TABLE IF NOT EXISTS public.action_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    action TEXT NOT NULL,
    target_id TEXT NOT NULL,
    details TEXT,
    before_data JSONB,
    after_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS before_data JSONB;
ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS after_data JSONB;

-- 9. Report types
CREATE TABLE IF NOT EXISTS public.report_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id TEXT NOT NULL,
    name TEXT NOT NULL,
    UNIQUE(server_id, name)
);

INSERT INTO public.report_types (server_id, name) VALUES
  ('1487863855798288467', 'pedophile'),
  ('1487863855798288467', 'skid'),
  ('1487863855798288467', 'doxxer'),
  ('1487863855798288467', 'scammer'),
  ('1487863855798288467', 'other')
ON CONFLICT (server_id, name) DO NOTHING;
