-- The Gooeb - Initial Database Schema
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Events table (supports multiple events)
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mask codes (pre-generated 4-digit codes for NFC tags)
CREATE TABLE mask_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    code CHAR(4) UNIQUE NOT NULL,
    is_claimed BOOLEAN DEFAULT false,
    claimed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Guests (registered users)
CREATE TABLE guests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    mask_code_id UUID UNIQUE REFERENCES mask_codes(id),
    nickname TEXT NOT NULL,
    photo_url TEXT NOT NULL,
    auth_token TEXT UNIQUE NOT NULL,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prompts pool - word prompts in 3 categories: character, theme, place
-- Between any two people, categories should not repeat across their bonds
CREATE TABLE prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    word TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('character', 'theme', 'place')),
    is_active BOOLEAN DEFAULT true,
    times_used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bonds (relationships between guests)
CREATE TABLE bonds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    guest_a_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    guest_b_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    prompt_id UUID REFERENCES prompts(id),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'completed', 'rejected', 'expired')),
    photo_url TEXT,
    initiated_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    -- Ensure different guests
    CONSTRAINT different_guests CHECK (guest_a_id != guest_b_id)
);

-- Note: Removed unique bond pair constraint to allow multiple bonds between same pair
-- (each with a different category prompt)

-- Create indexes for common queries
CREATE INDEX idx_mask_codes_code ON mask_codes(code);
CREATE INDEX idx_mask_codes_event ON mask_codes(event_id);
CREATE INDEX idx_guests_auth_token ON guests(auth_token);
CREATE INDEX idx_guests_event ON guests(event_id);
CREATE INDEX idx_bonds_guest_a ON bonds(guest_a_id);
CREATE INDEX idx_bonds_guest_b ON bonds(guest_b_id);
CREATE INDEX idx_bonds_status ON bonds(status);
CREATE INDEX idx_bonds_event ON bonds(event_id);
CREATE INDEX idx_prompts_event ON prompts(event_id);
CREATE INDEX idx_prompts_category ON prompts(category);

-- Row Level Security (RLS)
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mask_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bonds ENABLE ROW LEVEL SECURITY;

-- Policies: Allow read access for authenticated users (via service role for writes)
-- Note: The app uses service role key for mutations, anon key for reads

CREATE POLICY "Events are viewable by all" ON events
    FOR SELECT USING (true);

CREATE POLICY "Mask codes are viewable by all" ON mask_codes
    FOR SELECT USING (true);

CREATE POLICY "Guests are viewable by all" ON guests
    FOR SELECT USING (true);

CREATE POLICY "Prompts are viewable by all" ON prompts
    FOR SELECT USING (true);

CREATE POLICY "Bonds are viewable by all" ON bonds
    FOR SELECT USING (true);

-- Enable Realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE bonds;
ALTER PUBLICATION supabase_realtime ADD TABLE guests;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for guests updated_at
CREATE TRIGGER update_guests_updated_at
    BEFORE UPDATE ON guests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Seed data for initial event
INSERT INTO events (name, slug) VALUES ('The Gooeb Party', 'gooeb-party');

-- Generate 100 mask codes for the event
-- Using 4-digit numeric codes for easy manual entry
DO $$
DECLARE
    event_uuid UUID;
    code TEXT;
    i INTEGER;
BEGIN
    SELECT id INTO event_uuid FROM events WHERE slug = 'gooeb-party';

    FOR i IN 1..100 LOOP
        -- Generate random 4-digit code with leading zeros
        code := LPAD(floor(random() * 10000)::int::text, 4, '0');

        -- Insert (will skip duplicates due to unique constraint)
        BEGIN
            INSERT INTO mask_codes (event_id, code) VALUES (event_uuid, code);
        EXCEPTION WHEN unique_violation THEN
            -- Retry with new code
            NULL;
        END;
    END LOOP;
END $$;

-- Seed word prompts in 3 categories
-- CHARACTER: People, roles, archetypes to embody or reference
-- THEME: Abstract concepts, emotions, situations
-- PLACE: Locations, settings, environments

INSERT INTO prompts (event_id, word, category)
SELECT id, word, category
FROM events,
LATERAL (VALUES
    -- CHARACTER prompts (people/roles to embody)
    ('Pirate', 'character'),
    ('Robot', 'character'),
    ('Grandma', 'character'),
    ('Superhero', 'character'),
    ('Detective', 'character'),
    ('Alien', 'character'),
    ('Vampire', 'character'),
    ('Chef', 'character'),
    ('Wizard', 'character'),
    ('Rockstar', 'character'),
    ('Ninja', 'character'),
    ('Cowboy', 'character'),
    ('Ghost', 'character'),
    ('Astronaut', 'character'),
    ('Princess', 'character'),

    -- THEME prompts (concepts/emotions/situations)
    ('Chaos', 'theme'),
    ('Serenity', 'theme'),
    ('Betrayal', 'theme'),
    ('Discovery', 'theme'),
    ('Revenge', 'theme'),
    ('Love', 'theme'),
    ('Fear', 'theme'),
    ('Victory', 'theme'),
    ('Mystery', 'theme'),
    ('Rebellion', 'theme'),
    ('Nostalgia', 'theme'),
    ('Transformation', 'theme'),
    ('Celebration', 'theme'),
    ('Awkwardness', 'theme'),
    ('Teamwork', 'theme'),

    -- PLACE prompts (locations/settings)
    ('Underwater', 'place'),
    ('Moon', 'place'),
    ('Jungle', 'place'),
    ('Casino', 'place'),
    ('Haunted House', 'place'),
    ('Beach', 'place'),
    ('Mountain Top', 'place'),
    ('Spaceship', 'place'),
    ('Medieval Castle', 'place'),
    ('Tokyo', 'place'),
    ('Desert Island', 'place'),
    ('Subway', 'place'),
    ('Disco', 'place'),
    ('Laboratory', 'place'),
    ('Circus', 'place')
) AS t(word, category)
WHERE events.slug = 'gooeb-party';
