-- Point ledger for manual admin point adjustments
CREATE TABLE point_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id),
  guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,  -- positive or negative
  reason TEXT DEFAULT '',
  created_by UUID REFERENCES guests(id),  -- admin who made the change
  created_at TIMESTAMPTZ DEFAULT now()
);
