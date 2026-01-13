-- Migration: Dual Prompts + Activity Prompts
-- Each player gets a different individual prompt, plus both share an activity prompt

-- Add activity prompts table for shared activities between bonding pairs
CREATE TABLE activity_prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    times_used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_prompts_event ON activity_prompts(event_id);

-- Enable RLS
ALTER TABLE activity_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Activity prompts are viewable by all" ON activity_prompts
    FOR SELECT USING (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE activity_prompts;

-- Add new columns to bonds table for dual prompts
-- prompt_a_id = individual prompt for guest_a
-- prompt_b_id = individual prompt for guest_b
-- activity_prompt_id = shared activity prompt
ALTER TABLE bonds
    ADD COLUMN prompt_a_id UUID REFERENCES prompts(id),
    ADD COLUMN prompt_b_id UUID REFERENCES prompts(id),
    ADD COLUMN activity_prompt_id UUID REFERENCES activity_prompts(id);

-- Migrate existing prompt_id data to prompt_a_id (for backwards compatibility)
UPDATE bonds SET prompt_a_id = prompt_id WHERE prompt_id IS NOT NULL;

-- Seed activity prompts for the event
INSERT INTO activity_prompts (event_id, description)
SELECT id, description
FROM events,
LATERAL (VALUES
    ('Tell a story together, one sentence at a time'),
    ('Draw on the canvas together'),
    ('Do a secret handshake and teach it to each other'),
    ('Strike a dramatic pose together'),
    ('Have a conversation only using gestures'),
    ('Create a short dance move together'),
    ('Play rock-paper-scissors until someone wins 3 times'),
    ('Give each other compliments for 30 seconds'),
    ('Teach each other one skill or trick'),
    ('Make up a song together about your prompts'),
    ('Act out a scene from a movie using your prompts'),
    ('Play "two truths and a lie" with one round each'),
    ('Create a team cheer using your prompts'),
    ('Take a creative selfie representing your prompts'),
    ('Do an improvised interview based on your prompts')
) AS t(description)
WHERE events.slug = 'gooeb-party';
