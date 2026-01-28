-- Add recurrence support to events table
-- recurrence_rule stores the pattern; parent_event_id links generated instances back to the original
ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence_rule jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS parent_event_id uuid REFERENCES events(id) ON DELETE CASCADE;

-- Index for finding all instances of a recurring event
CREATE INDEX IF NOT EXISTS idx_events_parent_event_id ON events(parent_event_id);
