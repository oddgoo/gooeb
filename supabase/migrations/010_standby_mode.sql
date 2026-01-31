-- Add standby_mode to events table
ALTER TABLE events ADD COLUMN standby_mode BOOLEAN DEFAULT false;
