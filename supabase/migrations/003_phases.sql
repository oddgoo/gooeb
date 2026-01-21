-- Migration: Game Phases
-- Phases determine what activity prompts are given to users when they meld

-- Create phases table
CREATE TABLE phases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    phase_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, phase_number)
);

CREATE INDEX idx_phases_event ON phases(event_id);

-- Enable RLS
ALTER TABLE phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Phases are viewable by all" ON phases
    FOR SELECT USING (true);

-- Add current_phase_id to events table
ALTER TABLE events
    ADD COLUMN current_phase_id UUID REFERENCES phases(id);

-- Add phase_numbers and activity_category to activity_prompts
-- phase_numbers: array of phase numbers this prompt can appear in (defaults to {1})
-- activity_category: type of activity (drawing, acting, photo, etc.)
ALTER TABLE activity_prompts
    ADD COLUMN phase_numbers INTEGER[] DEFAULT '{1}',
    ADD COLUMN activity_category TEXT DEFAULT 'general';

-- Seed default phases for the event
INSERT INTO phases (event_id, phase_number, name)
SELECT id, phase_number, name
FROM events,
LATERAL (VALUES
    (1, 'Phase 1: Icebreaker'),
    (2, 'Phase 2: Creative'),
    (3, 'Phase 3: Finale')
) AS t(phase_number, name)
WHERE events.slug = 'gooeb-party';

-- Set default current phase to Phase 1
UPDATE events
SET current_phase_id = (
    SELECT p.id FROM phases p
    WHERE p.event_id = events.id AND p.phase_number = 1
)
WHERE slug = 'gooeb-party';

-- Update activity prompts with phase_numbers and activity_category
-- Phase 1: Icebreaker activities (simpler, social)
-- Phase 2: Creative activities (more involved, artistic)

UPDATE activity_prompts SET phase_numbers = '{1}', activity_category = 'storytelling'
WHERE description = 'Tell a story together, one sentence at a time';

UPDATE activity_prompts SET phase_numbers = '{1,2}', activity_category = 'drawing'
WHERE description = 'Draw on the canvas together';

UPDATE activity_prompts SET phase_numbers = '{1}', activity_category = 'physical'
WHERE description = 'Do a secret handshake and teach it to each other';

UPDATE activity_prompts SET phase_numbers = '{1}', activity_category = 'photo'
WHERE description = 'Strike a dramatic pose together';

UPDATE activity_prompts SET phase_numbers = '{1,2}', activity_category = 'acting'
WHERE description = 'Have a conversation only using gestures';

UPDATE activity_prompts SET phase_numbers = '{1,2}', activity_category = 'physical'
WHERE description = 'Create a short dance move together';

UPDATE activity_prompts SET phase_numbers = '{1}', activity_category = 'game'
WHERE description = 'Play rock-paper-scissors until someone wins 3 times';

UPDATE activity_prompts SET phase_numbers = '{1}', activity_category = 'social'
WHERE description = 'Give each other compliments for 30 seconds';

UPDATE activity_prompts SET phase_numbers = '{1,2}', activity_category = 'teaching'
WHERE description = 'Teach each other one skill or trick';

UPDATE activity_prompts SET phase_numbers = '{2}', activity_category = 'music'
WHERE description = 'Make up a song together about your prompts';

UPDATE activity_prompts SET phase_numbers = '{2}', activity_category = 'acting'
WHERE description = 'Act out a scene from a movie using your prompts';

UPDATE activity_prompts SET phase_numbers = '{1}', activity_category = 'game'
WHERE description = 'Play "two truths and a lie" with one round each';

UPDATE activity_prompts SET phase_numbers = '{2}', activity_category = 'creative'
WHERE description = 'Create a team cheer using your prompts';

UPDATE activity_prompts SET phase_numbers = '{1,2}', activity_category = 'photo'
WHERE description = 'Take a creative selfie representing your prompts';

UPDATE activity_prompts SET phase_numbers = '{2}', activity_category = 'acting'
WHERE description = 'Do an improvised interview based on your prompts';
