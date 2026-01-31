-- Migration 009: Remix Phase
-- Adds remix_bond_id and phase_number to bonds table
-- Replaces 3 placeholder phases with Source (1) and Remix (2)

-- Add remix fields to bonds
ALTER TABLE bonds ADD COLUMN remix_bond_id UUID REFERENCES bonds(id) ON DELETE SET NULL;
ALTER TABLE bonds ADD COLUMN phase_number INTEGER DEFAULT 1;

-- Clear FK references before deleting phases
UPDATE events SET current_phase_id = NULL;
DELETE FROM phases;

-- Get the active event ID for inserting phases
DO $$
DECLARE
  v_event_id UUID;
  v_source_phase_id UUID;
BEGIN
  SELECT id INTO v_event_id FROM events WHERE is_active = true LIMIT 1;
  IF v_event_id IS NULL THEN
    RAISE NOTICE 'No active event found, skipping phase creation';
    RETURN;
  END IF;

  -- Create Source phase (phase 1)
  INSERT INTO phases (event_id, phase_number, name)
  VALUES (v_event_id, 1, 'Source')
  RETURNING id INTO v_source_phase_id;

  -- Create Remix phase (phase 2)
  INSERT INTO phases (event_id, phase_number, name)
  VALUES (v_event_id, 2, 'Remix');

  -- Set current phase to Source
  UPDATE events SET current_phase_id = v_source_phase_id WHERE id = v_event_id;

  -- Insert Remix activity prompts (phase 2 only)
  INSERT INTO activity_prompts (event_id, description, is_active, phase_numbers, activity_category)
  VALUES
    (v_event_id, 'Strike a remix pose inspired by the original meld!', true, '{2}', 'pose'),
    (v_event_id, 'Draw your own remix of the original meld!', true, '{2}', 'drawing'),
    (v_event_id, 'Craft a remix creation inspired by the original meld!', true, '{2}', 'craft');
END $$;
