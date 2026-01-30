-- Add 'cancelled' to the bonds status CHECK constraint
ALTER TABLE bonds DROP CONSTRAINT IF EXISTS bonds_status_check;
ALTER TABLE bonds ADD CONSTRAINT bonds_status_check
  CHECK (status IN ('pending', 'accepted', 'completed', 'rejected', 'cancelled', 'expired'));
