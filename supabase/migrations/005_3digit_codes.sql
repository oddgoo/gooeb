-- Replace all mask codes with 3-digit codes
-- Safe to run before the event starts (no claimed codes)

-- Delete all existing mask codes
DELETE FROM mask_codes;

-- Alter column type
ALTER TABLE mask_codes ALTER COLUMN code TYPE CHAR(3);

-- Generate 100 unique 3-digit codes
DO $$
DECLARE
    event_uuid UUID;
    new_code TEXT;
    i INTEGER;
BEGIN
    SELECT id INTO event_uuid FROM events LIMIT 1;

    i := 0;
    WHILE (SELECT COUNT(*) FROM mask_codes) < 100 AND i < 1000 LOOP
        new_code := LPAD(floor(random() * 1000)::int::text, 3, '0');
        BEGIN
            INSERT INTO mask_codes (event_id, code) VALUES (event_uuid, new_code);
        EXCEPTION WHEN unique_violation THEN
            NULL;
        END;
        i := i + 1;
    END LOOP;
END $$;
