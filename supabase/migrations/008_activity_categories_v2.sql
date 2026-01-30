-- Migration: New activity categories and phase 1 activity prompts
-- Categories: drawing, pose, craft, photo (replacing general, drawing, acting, photo, music, physical)
-- Photo activities do NOT use word prompts; others do.

-- Remove all existing bonds (test data; they reference old activity prompts)
DELETE FROM bonds
WHERE event_id IN (SELECT id FROM events WHERE slug = 'gooeb-party');

-- Remove all old activity prompts (they were placeholder/test data)
DELETE FROM activity_prompts
WHERE event_id IN (SELECT id FROM events WHERE slug = 'gooeb-party');

-- Update default category
ALTER TABLE activity_prompts ALTER COLUMN activity_category SET DEFAULT 'drawing';

-- Insert the 6 phase-1 activity prompts
INSERT INTO activity_prompts (event_id, description, phase_numbers, activity_category, is_active)
SELECT id, description, phase_numbers, activity_category, true
FROM events,
LATERAL (VALUES
    ('Take a photo (without either of you in it) that represents Joy', '{1}'::integer[], 'photo'),
    ('Take a photo (without either of you in it) that represents Embarrassment', '{1}'::integer[], 'photo'),
    ('Take a photo (without either of you in it) that represents Seriousness', '{1}'::integer[], 'photo'),
    ('Strike a pose, take a selfie together!', '{1}'::integer[], 'pose'),
    ('Taking turns, draw something one line at a time. You can use the walls or the tables!', '{1}'::integer[], 'drawing'),
    ('With any materials on the table, craft/assemble something together, no drawing for this one!', '{1}'::integer[], 'craft')
) AS t(description, phase_numbers, activity_category)
WHERE events.slug = 'gooeb-party';
