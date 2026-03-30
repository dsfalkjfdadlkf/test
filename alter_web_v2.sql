
ALTER TABLE web_profiles 
ADD COLUMN IF NOT EXISTS status_emoji text,
ADD COLUMN IF NOT EXISTS status_text text,
ADD COLUMN IF NOT EXISTS theme_primary text,
ADD COLUMN IF NOT EXISTS theme_accent text;
