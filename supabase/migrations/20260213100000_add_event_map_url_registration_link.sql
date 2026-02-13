-- Add map_url and registration_link columns to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS map_url text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_link text;
