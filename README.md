# The Gooeb

A real-time multiplayer party game about bonding creatively. Guests wear masks with NFC tags, register via their phones, and complete creative prompts together.

## Prerequisites

- Node.js 18+
- A Supabase project (free tier works)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the migration:
   ```bash
   # Copy contents of this file and paste into SQL Editor:
   supabase/migrations/001_initial_schema.sql
   ```
3. Go to **Storage** and create a bucket called `photos` (set it to **Public**)
4. Get your credentials from **Settings > API**

### 3. Configure environment

Create a `.env` file in the project root:

```bash
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Seed test data

In Supabase SQL Editor, run:

```sql
-- Create a test event
INSERT INTO events (id, name, slug, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', 'Test Party', 'test', true);

-- Create some mask codes (use these to register)
INSERT INTO mask_codes (event_id, code, is_claimed) VALUES
('00000000-0000-0000-0000-000000000001', '1234', false),
('00000000-0000-0000-0000-000000000001', '5678', false),
('00000000-0000-0000-0000-000000000001', '9999', false),
('00000000-0000-0000-0000-000000000001', '0000', false);

-- Create some prompts
INSERT INTO prompts (event_id, word, category, is_active) VALUES
('00000000-0000-0000-0000-000000000001', 'Pirate', 'character', true),
('00000000-0000-0000-0000-000000000001', 'Robot', 'character', true),
('00000000-0000-0000-0000-000000000001', 'Wizard', 'character', true),
('00000000-0000-0000-0000-000000000001', 'Chaos', 'theme', true),
('00000000-0000-0000-0000-000000000001', 'Love', 'theme', true),
('00000000-0000-0000-0000-000000000001', 'Mystery', 'theme', true),
('00000000-0000-0000-0000-000000000001', 'Underwater', 'place', true),
('00000000-0000-0000-0000-000000000001', 'Moon', 'place', true),
('00000000-0000-0000-0000-000000000001', 'Disco', 'place', true);
```

## Running locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Testing the flow

1. Open the app in two browser windows (or use incognito for the second)
2. In window 1: Enter code `1234` → Register with nickname + photo
3. In window 2: Enter code `5678` → Register with nickname + photo
4. In window 1: Enter `5678` in the "New Bond" section → Send Invite
5. In window 2: See incoming invite → Click Accept
6. Both windows now show an active bond with a prompt
7. Either window: Click "Complete Bond" → Take photo → Submit
8. Both windows: Bond appears in Completed section

## Commands

```bash
npm run dev              # Start dev server
npm run check            # TypeScript check
npm run build            # Production build
npm run preview          # Preview production build
npm run test             # Run unit tests
npm run test:watch       # Run unit tests in watch mode
npm run test:integration # Run integration tests (requires Supabase)
```

## Testing

### Unit Tests
Unit tests run without Supabase and test pure utility functions:

```bash
npm run test
```

### Integration Tests
Integration tests run against your real Supabase database. Make sure your `.env` is configured with valid credentials and seed data exists:

```bash
npm run test:integration
```

Integration tests will:
- Create temporary test guests and bonds
- Test bond creation, status updates, and queries
- Clean up test data after each test

### Load Testing

Two load testing scripts are available to verify the system can handle party-scale traffic:

#### Basic Load Test (HTTP only)
Simulates 30 concurrent users making requests to various endpoints. Doesn't create real data - just tests endpoint responsiveness.

```bash
# Local
npx tsx scripts/load-test.ts http://localhost:5173

# Production
npx tsx scripts/load-test.ts https://thegooeb.com
```

#### Integration Load Test (Full flow)
Creates real users and bonds in the database to test the complete flow. Requires unclaimed mask codes in the database. Cleans up after itself.

```bash
# Local
npx tsx scripts/integration-load-test.ts http://localhost:5173

# Production
npx tsx scripts/integration-load-test.ts https://thegooeb.com
```

**Prerequisites for integration load test:**
- At least 10 unclaimed mask codes in the database
- Valid `.env` with `SUPABASE_SERVICE_ROLE_KEY`
- An active event

**What it does:**
1. Finds unclaimed mask codes
2. Registers test users (`LoadTest0`, `LoadTest1`, etc.)
3. Creates and completes bonds between users (~1/second for 30s)
4. Reports success rates and response times
5. Cleans up all test data (guests, bonds, photos, resets mask codes)

## Tech Stack

- SvelteKit 5 + TypeScript
- Tailwind CSS (Windows 3.1 retro theme)
- Supabase (PostgreSQL + Realtime + Storage)
- Vercel (deployment)
