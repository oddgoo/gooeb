-- Migration 011: Replace all prompts with new set
-- Deletes all existing prompts and inserts new ones

-- Clear existing prompts
DELETE FROM prompts;

-- Insert new prompts for all active events
INSERT INTO prompts (event_id, word, category)
SELECT id, word, category
FROM events,
LATERAL (VALUES
    -- CHARACTER prompts
    ('A Wet Wolf', 'character'),
    ('Yellow Banana', 'character'),
    ('Magpie', 'character'),
    ('Amoeba', 'character'),
    ('Wizard', 'character'),
    ('Inspector Javert', 'character'),
    ('Trickster', 'character'),
    ('Tetrahedron', 'character'),
    ('Muffin Man', 'character'),
    ('Warlock', 'character'),
    ('A Sexy TV', 'character'),
    ('Big Blue Fish', 'character'),
    ('Rock Druid', 'character'),
    ('Benny the Seal', 'character'),
    ('A Tamal', 'character'),
    ('Summer Bunny', 'character'),
    ('Karl Marx', 'character'),
    ('Mabubu the Genie', 'character'),
    ('Sad Dishwasher', 'character'),
    ('Brooklyn Man', 'character'),
    ('Bird-eating fridge', 'character'),

    -- THEME prompts (concepts/emotions/situations)
    ('Chaos', 'theme'),
    ('Serenity', 'theme'),
    ('Betrayal', 'theme'),
    ('Weathering', 'theme'),
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
    ('Marrickville', 'place'),
    ('Moon', 'place'),
    ('Service NSW', 'place'),
    ('Haunted House', 'place'),
    ('Beach', 'place'),
    ('Mountain Top', 'place'),
    ('Space Station', 'place'),
    ('A Tree', 'place'),
    ('Belgian Waffle House', 'place'),
    ('Inside a Computer', 'place'),
    ('Theatre', 'place'),
    ('The ruins of Sydney', 'place'),
    ('Cornhub', 'place'),
    ('Meadowbank station', 'place'),
    ('Antartica', 'place'),
    ('Parramatta Aquatic Centre', 'place'),
    ('Circus', 'place')
) AS v(word, category)
WHERE events.is_active = true;

-- Add prose activity prompts
INSERT INTO activity_prompts (event_id, description, phase_numbers, activity_category, is_active)
SELECT id, description, phase_numbers, activity_category, true
FROM events,
LATERAL (VALUES
    ('Take turns writing a small poem one word at a time', '{1}'::integer[], 'prose'),
    ('Remix the original meld as a poem. One word at a time.', '{2}'::integer[], 'prose')
) AS t(description, phase_numbers, activity_category)
WHERE events.is_active = true;
