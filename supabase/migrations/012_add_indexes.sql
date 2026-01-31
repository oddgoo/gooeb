-- Add indexes for frequently queried columns to improve performance under load

CREATE INDEX IF NOT EXISTS idx_bonds_guest_a_id ON bonds(guest_a_id);
CREATE INDEX IF NOT EXISTS idx_bonds_guest_b_id ON bonds(guest_b_id);
CREATE INDEX IF NOT EXISTS idx_bonds_status ON bonds(status);
CREATE INDEX IF NOT EXISTS idx_bonds_phase_number ON bonds(phase_number);
CREATE INDEX IF NOT EXISTS idx_point_ledger_guest_id ON point_ledger(guest_id);
CREATE INDEX IF NOT EXISTS idx_guests_mask_code_id ON guests(mask_code_id);
