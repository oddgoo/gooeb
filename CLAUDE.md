# CLAUDE.md - Cuauh's Mega Mind Meld Imaginarium OS

> **IMPORTANT**: Always check this file at the START and END of every session. Update the status section when completing tasks.

## Agent Instructions

### MCP Tools
- **Always use `context7` MCP** for documentation lookups (SvelteKit, Supabase, Tailwind, vis.js)
- Prefer MCP tools over web searches when available

### Session Protocol
1. **START of session**: Read this file to understand project state and requirements
2. **DURING session**: Reference technical requirements and update todos
3. **END of session**: Update the Implementation Status section below

---

## Project Overview

**Cuauh's Mega Mind Meld Imaginarium OS** is a real-time multiplayer party game about melding minds creatively. Played on guests' phones during a ~3 hour birthday party with 40-55 guests.

### Core Concept
- Guests wear masks with NFC tags pre-programmed with unique 3-digit codes
- Guests register via NFC tap, QR code, or manual code entry
- The game has phases where guests meld with each other through prompts
- A showcase display shows a real-time network graph of all melds
- Guests are assigned to teams and earn points for melding

---

## Technical Requirements

### Tech Stack
- **Frontend**: SvelteKit 5 + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Realtime + Storage)
- **Graph Visualization**: vis.js (Network)
- **Deployment**: Vercel

### App Structure
**Simplified single-page app** - The Meld page is the main experience. No tabs.

- `/` - Landing page (unauthenticated) → redirects to `/bond` if authenticated
- `/bond` - Main melding interface (authenticated)
- `/bond/profile` - Profile editing page (nickname, photo, completed melds)
- `/bond/[id]/complete` - Meld completion page (take photo)
- `/showcase` - Big screen display (public)
- `/admin` - Moderation panel (admin only)
- `/join/[code]` - NFC/QR entry point (redirects based on auth state)

---

## Detailed Requirements

### Setup / Authentication (Simplified)
- Guests receive masks with NFC tags containing URLs like `megamindmeld.vercel.app/join/XXX`
- Landing page allows manual 3-digit code entry (or NFC tap, QR scan)
- Registration: nickname + photo upload (camera or file)
- **Simplified auth**: Mask code stored in both localStorage AND cookie (`gooeb_code`)
  - Cookie allows server-side auth validation on page loads
  - localStorage provides client-side access
  - Both are synced by the auth store
- API routes can use the mask code for identification - server looks up guest by code
- **Reclaim flow**: Guests can re-login to an already-claimed code via `/api/reclaim`
- No strict security needed - it's a party game!

### Phase 1 - Melding
- Goal: Connect with others by tapping each other's NFC tags or entering codes
- **Invite Flow**:
  1. Player A taps Player B's tag (or enters code)
  2. Server looks up guest → shows profile modal (photo, nickname, intro text)
  3. Player confirms → creates "meld invitation" (pending state)
  4. Player B sees invite on Meld page
  5. Player B taps Player A's tag to confirm (auto-accept)
- **Dual Word Prompt System**:
  - On acceptance, **each player** gets their own random word prompt from different categories
  - Three categories: **character**, **theme**, **place**
    - **Character**: Roles/archetypes (Pirate, Robot, Wizard, etc.)
    - **Theme**: Concepts/emotions (Chaos, Love, Mystery, etc.)
    - **Place**: Locations/settings (Underwater, Moon, Disco, etc.)
  - **Category non-repetition**: Between any two people, categories cannot repeat
    - Max 3 melds possible between same pair (one per category)
  - Display shows: "Your words are: **X** + **Y**" (simplified single-row format)
- **Activity Prompts**: Each meld also gets a shared activity prompt (e.g., "Strike a pose together!")
  - Activity prompts are phase-aware and category-tagged
- **Cancel**: Players can cancel accepted melds (with confirmation dialog)
- Any player submits photo of completion
- Server stores: completion photo, prompt words + categories, activity, participants

### Phases System
- Events have a `current_phase_id` pointing to the active phase
- Default phases: Phase 1 (Source), Phase 2 (Remix)
- Activity prompts are filtered by phase number when assigned to melds
- Admin switches phases via the admin panel

### Teams System
- Admin generates teams with configurable team size (default 4)
- Guests shuffled and assigned random animal emoji teams (🦊, 🐙, 🦎, etc.)
- Team emoji displays in the bond page title bar: "Mind Meld Manager | Team 🦊"
- Teams can be cleared and regenerated

### Points / Scoring System
- **Automatic scoring**:
  - Completed meld: **5 points**
  - Accepted meld (pending completion): **1 point**
- **Manual ledger**: Admin can add/subtract points with reasons
- Points displayed in bond page status bar and showcase leaderboard
- Points calculated from deduplicated bonds (one per pair, preferring completed status)

### Phase 2 - Remix ✅ IMPLEMENTED
- When admin switches to Phase 2 (Remix), melding mechanics change:
  - No word prompts assigned — instead, each meld gets a **random completed Source meld** as reference
  - The source meld's photo is displayed to both players as the thing to "remix"
  - Activity prompts are still assigned (filtered to phase 2: pose/drawing/craft)
  - Max **1 remix meld per pair** (vs 3 in Source phase)
- Invite flow checks `phase_number` to enforce per-phase limits
- Bond deduplication is per-pair **per-phase** for scoring
- Network graph shows remix edges in **teal/cyan** with curved lines to distinguish from Source edges
- UI displays "REMIX" badge and teal gradient (vs pink/magenta for Source)

### Admin View
- **Guests tab**: View, delete guests (cascades to melds)
- **Melds tab**: View, delete melds
- **Prompts tab**: Add/toggle/delete word prompts by category
- **Phases tab**: View/create/delete phases, switch active phase
- **Activities tab**: Manage activity prompts (create, toggle, edit phase/category, delete)
- **Teams tab**: Generate teams (set size), view current teams, clear teams
- **Points tab**: Manual point ledger - add/subtract points with reason
- **Bulk upload**: Upload CSV + photos for prepopulated guests

### Showcase View (Big Screen Display)
- 3-way toggle: **Network** / **Teams** / **Awards**
- Real-time vis.js network graph showing all melds
- Guest search (highlights & zooms to guest in graph)
- Slideshow of submitted photos (click for gallery view)
- Confetti animation + slide-in announcement when new melds complete
- Leaderboard of most melds (includes automatic + manual points)
- Collaborative goal tracker (melds done / all possible combinations)
- **Meld detail modal**: Tap a meld to see photo, both guests, and simplified prompt display
- **Awards tab**: Auto-generated superlatives computed server-side from game data
  - Mind Meld Champion (most points), Social Butterfly (most unique partners), Lightning Melder (fastest avg completion), Remix Master (most remixes), Dream Team (top team score)
  - Manual left/right navigation + keyboard arrows, fly transitions, dot indicators

### Profile Page
- Accessible via profile button (👤) in bond page title bar
- Edit nickname and profile photo
- View 3-digit mask code
- "About You" section (if `intro_text` exists from prepopulated data)
- **Completed melds list**: Tap any completed meld to open detail modal (photo, guests, prompts)
- Sign out button

---

## Technical Concerns & Mitigations

| Concern | Mitigation |
|---------|------------|
| NFC flakiness | Treat `/join/[code]` visits as "actions" not "navigation". If authenticated, interpret as sending invite. Prominent manual entry fallback. |
| Race conditions | Optimistic locking via WHERE clauses (`eq('is_claimed', false)`). Rollback on failure. |
| Large images | Client-side resize to max 1200px, JPEG quality 0.85 before upload |
| Concurrent load | Supabase handles 40-55 guests. vis.js performant to 100+ nodes |
| Mobile camera issues | File upload fallback, clear error messages |

---

## Database Schema

### Tables
- **events** - id, name, slug, is_active, current_phase_id
- **phases** - id, event_id, phase_number, name (unique per event+number)
- **mask_codes** - id, event_id, code (CHAR 3), is_claimed, claimed_at
- **guests** - id, event_id, mask_code_id, nickname, photo_url, auth_token, is_admin, team_emoji, intro_text
- **prompts** - id, event_id, word, category (character|theme|place), is_active, times_used
- **activity_prompts** - id, event_id, description, is_active, times_used, phase_numbers[], activity_category
- **bonds** - id, event_id, guest_a_id, guest_b_id, prompt_id (legacy), prompt_a_id, prompt_b_id, activity_prompt_id, remix_bond_id, phase_number, status, photo_url, timestamps
- **point_ledger** - id, event_id, guest_id, points (positive/negative), reason, created_by, created_at

### Migrations
1. `001_initial_schema.sql` - Base tables (events, mask_codes, guests, prompts, bonds)
2. `002_dual_prompts.sql` - Dual prompts (prompt_a_id, prompt_b_id) + activity_prompts table
3. `003_phases.sql` - Phases table, phase_numbers/activity_category on activity_prompts
4. `004_teams.sql` - team_emoji column on guests
5. `005_3digit_codes.sql` - Changed from 4-digit to 3-digit numeric codes (000-999)
6. `006_intro_text.sql` - intro_text column on guests
7. `007_point_ledger.sql` - Point ledger table for manual scoring
8. `008_activity_categories_v2.sql` - New activity categories (drawing/pose/craft/photo), seed phase 1 prompts, clear old bonds + activity prompts
9. `009_remix_phase.sql` - Add remix_bond_id (FK to bonds) + phase_number (default 1) to bonds, replace placeholder phases with Source (1) and Remix (2), seed remix activity prompts

### Meld Statuses (DB column: status)
- `pending` - Invite sent, awaiting acceptance
- `accepted` - Both confirmed, prompts assigned
- `completed` - Photo submitted and confirmed
- `rejected` - Declined by recipient
- `cancelled` - Cancelled by a participant
- `expired` - Timed out

### Prompt Categories
- `character` - Roles/archetypes to embody
- `theme` - Abstract concepts/emotions
- `place` - Locations/settings

### Activity Prompt Categories
- `drawing` 🎨 - Drawing activities (word prompts assigned)
- `pose` 💃 - Posing/selfie activities (word prompts assigned)
- `craft` 🧶 - Crafting/assembling activities (word prompts assigned)
- `photo` 📷 - Photo activities (NO word prompts assigned)

### Key Constraints
- Multiple melds allowed between same pair (up to 3, one per category)
- Category non-repetition enforced in application logic when assigning prompts
- Supabase Realtime enabled on `bonds` and `guests` tables (DB table name unchanged)
- Dual prompts: each player gets a different word from different categories

---

## API Routes

### Bond Operations
- `POST /api/bond/invite` - Send meld invite
- `POST /api/bond/accept` - Accept invite (assigns dual prompts + activity)
- `POST /api/bond/reject` - Reject invite
- `POST /api/bond/cancel` - Cancel accepted meld
- `GET /api/bond/list` - List user's melds (returns bonds, myPoints, myTeamEmoji)
- `POST /api/bond/[id]/complete` - Complete meld with photo

### Guest / Profile
- `POST /api/register` - Register new guest
- `POST /api/reclaim` - Re-login with code
- `GET /api/guest/lookup?code=XXX` - Look up guest by code (returns id, nickname, photo_url, intro_text)
- `POST /api/profile/update` - Update nickname and/or photo

### Showcase
- `GET /api/showcase` - All data for showcase display

### Admin
- `GET/DELETE /api/admin/guests` - Manage guests
- `POST /api/admin/guests/bulk` - Bulk upload CSV + photos
- `GET/DELETE /api/admin/bonds` - Manage melds
- `GET/POST/PATCH/DELETE /api/admin/prompts` - Manage word prompts
- `GET/POST/PATCH/DELETE /api/admin/activity-prompts` - Manage activity prompts
- `GET/POST/PATCH/DELETE /api/admin/phases` - Manage phases
- `POST/DELETE /api/admin/teams` - Generate/clear teams
- `GET/POST/DELETE /api/admin/points` - Manual point ledger

---

## File Structure

```
/Users/oddgoo/DEV/gooeb/
├── src/
│   ├── routes/
│   │   ├── +page.svelte              # Landing page (code entry)
│   │   ├── +page.server.ts           # Redirect auth users to /bond
│   │   ├── join/[code]/              # NFC/QR entry point
│   │   ├── register/                 # Registration (photo + nickname)
│   │   ├── api/
│   │   │   ├── register/             # Registration API
│   │   │   ├── reclaim/              # Re-login API
│   │   │   ├── guest/lookup/         # Guest lookup by code
│   │   │   ├── profile/update/       # Profile update API
│   │   │   ├── bond/                 # Meld APIs (route path unchanged)
│   │   │   │   ├── invite/           # Send meld invite
│   │   │   │   ├── accept/           # Accept invite (assigns prompts)
│   │   │   │   ├── reject/           # Reject invite
│   │   │   │   ├── cancel/           # Cancel accepted meld
│   │   │   │   ├── list/             # List user's melds + points + team
│   │   │   │   └── [id]/complete/    # Complete meld with photo
│   │   │   ├── showcase/             # Showcase data endpoint
│   │   │   └── admin/
│   │   │       ├── guests/           # Guest management + bulk upload
│   │   │       ├── bonds/            # Meld management
│   │   │       ├── prompts/          # Word prompt management
│   │   │       ├── activity-prompts/ # Activity prompt management
│   │   │       ├── phases/           # Phase management
│   │   │       ├── teams/            # Team generation
│   │   │       └── points/           # Manual point ledger
│   │   ├── (app)/                    # Protected routes
│   │   │   ├── +layout.server.ts     # Auth guard
│   │   │   ├── +layout.svelte        # App shell
│   │   │   ├── bond/+page.svelte     # Main melding interface
│   │   │   ├── bond/profile/         # Profile editing page
│   │   │   └── bond/[id]/complete/   # Meld completion page
│   │   ├── showcase/+page.svelte     # Public display (16:9 optimized)
│   │   └── admin/+page.svelte        # Admin panel (tabbed)
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts             # Browser Supabase client
│   │   │   ├── server.ts             # Server Supabase client
│   │   │   ├── bonds.ts              # Bond logic (prompt assignment, accept, remix, resolvePhaseNumber)
│   │   │   └── types.ts              # Database types
│   │   ├── scoring/
│   │   │   ├── index.ts              # Score calculation logic
│   │   │   ├── rules.ts              # Scoring rules (5pts completed, 1pt accepted)
│   │   │   └── types.ts              # Scoring types
│   │   ├── stores/
│   │   │   ├── auth.ts               # Auth state
│   │   │   └── bonds.ts              # Melds state + realtime (Bond type, myPoints, myTeamEmoji)
│   │   ├── components/
│   │   │   ├── PhotoCapture.svelte   # Camera + upload
│   │   │   ├── NetworkGraph.svelte   # vis.js network graph
│   │   │   └── LoadingSpinner.svelte # Loading indicator
│   │   └── utils/
│   │       ├── codes.ts              # 3-digit code utilities
│   │       ├── image.ts              # Client-side resize
│   │       ├── teamEmojis.ts         # 30 animal emoji list for teams
│   │       └── activityEmojis.ts     # Activity category → emoji mapping
│   └── app.css                       # Tailwind + custom styles
├── supabase/migrations/
│   ├── 001_initial_schema.sql
│   ├── 002_dual_prompts.sql
│   ├── 003_phases.sql
│   ├── 004_teams.sql
│   ├── 005_3digit_codes.sql
│   ├── 006_intro_text.sql
│   ├── 007_point_ledger.sql
│   └── 008_activity_categories_v2.sql
├── scripts/
│   └── load-test.ts                  # Load testing script
├── .env                              # Local env vars
└── [config files]
```

---

## Key Types

### Bond (from `src/lib/stores/bonds.ts`)
```typescript
type Bond = {
  id: string;
  status: 'pending' | 'accepted' | 'completed';
  isInitiator: boolean;
  partner: { id: string; nickname: string; photo_url: string };
  prompt: BondPrompt | null;           // Legacy single prompt
  myPrompt: BondPrompt | null;         // User's individual prompt
  partnerPrompt: BondPrompt | null;    // Partner's individual prompt
  activityPrompt: ActivityPrompt | null; // Shared activity
  photo_url: string | null;
  initiated_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  remixBondId: string | null;          // Reference to source bond being remixed
  remixSourcePhoto: string | null;     // Photo from the source bond
  isRemix: boolean;                    // True if this is a remix-phase bond
};

type BondPrompt = { id: string; word: string; category: 'character' | 'theme' | 'place' };
type ActivityPrompt = { id: string; description: string; activity_category: string | null };
```

### Bond Store State
```typescript
type BondsState = {
  bonds: Bond[];
  myId: string | null;
  myPoints: number;
  myTeamEmoji: string | null;
  loading: boolean;
  error: string | null;
};
```

### Derived Stores
- `pendingIncoming` - Pending bonds where user is not initiator
- `pendingOutgoing` - Pending bonds where user is initiator
- `activeBonds` - Accepted bonds (awaiting completion)
- `completedBonds` - Completed bonds
- `myPoints` - User's total score
- `myTeamEmoji` - User's team emoji

---

## UI Patterns

### Prompt Display (Simplified)
- **Active meld panel**: Shows category emoji + activity prompt description + "Your words are: **X** + **Y**" in gradient box
- **Meld completion page**: Same simplified "Your words are: **X** + **Y**" format
- **Showcase detail modal**: Category emoji + activity description + "Their words: **X** + **Y**"
- **Profile meld detail modal**: Same format as showcase, using "Your words" phrasing
- Word prompts are only shown when assigned (photo activities have no word prompts)
- Legacy single-prompt fallback supported throughout

### Meld Detail Modal (used in showcase + profile)
- Meld photo (if exists)
- Both guests with photos and names, handshake emoji between
- Activity prompt + words display in gradient box

---

## Implementation Status

### Session Plan

| Session | Focus | Status |
|---------|-------|--------|
| 1 | Project setup, DB schema, auth | ✅ COMPLETE |
| 2 | Melding mechanics (invite/accept/prompts) | ✅ COMPLETE |
| 3 | Photo upload, completion flow | ✅ COMPLETE |
| 4 | Showcase + Admin views | ✅ COMPLETE |
| 5 | Polish + Deploy | ✅ COMPLETE |
| 6+ | Features & refinements | 🟡 ONGOING |

### Session 1 - COMPLETE ✅

**Completed:**
- [x] SvelteKit project initialized with TypeScript
- [x] Tailwind CSS configured with custom `gooeb` color palette
- [x] Dependencies installed (supabase-js, uuid, vis-network)
- [x] Database schema SQL created (`supabase/migrations/001_initial_schema.sql`)
- [x] Supabase client utilities (browser + server)
- [x] Auth store with localStorage + cookie persistence
- [x] Landing page with code entry
- [x] `/join/[code]` route handling NFC/QR entry
- [x] Registration page with camera capture + file upload
- [x] Client-side image resize utility
- [x] Register API endpoint with race condition protection
- [x] Protected app routes with auth guard
- [x] Meld page with user info header + invite form
- [x] Authenticated users redirect from `/` to `/bond`

### Session 2 - COMPLETE ✅

**Completed:**
- [x] Melds store with realtime Supabase subscriptions
- [x] Meld invite/accept/reject API endpoints
- [x] Meld list API endpoint
- [x] Prompt assignment with category non-repetition (max 3 melds per pair)
- [x] Pending incoming/outgoing invites display
- [x] Active meld prompt view
- [x] Completed melds list
- [x] Realtime updates via Supabase subscriptions

### Session 3 - COMPLETE ✅

**Completed:**
- [x] Photo capture for meld completion
- [x] Meld completion API endpoint
- [x] Photo upload to Supabase Storage (`bonds/{id}.jpg`)

### Session 4 - COMPLETE ✅

**Completed:**
- [x] NetworkGraph component with vis.js
- [x] Showcase page with graph, slideshow, leaderboard, stats, confetti
- [x] Admin page with guest/meld/prompt management (tabbed)
- [x] Showcase + Admin API endpoints

### Session 5 - COMPLETE ✅

**Completed:**
- [x] Load testing script (`scripts/load-test.ts`)
- [x] Showcase gallery view + new meld announcements + guest search
- [x] Rename: "Gooeb" → "Cuauh's Mega Mind Meld Imaginarium OS"
- [x] Rename: "Bond/Bonding" → "Meld/Melding" throughout UI
- [x] Vercel deployment

### Post-Launch Features ✅

**Completed:**
- [x] **Dual prompt system** (migration 002): Each player gets their own word prompt
- [x] **Activity prompts**: Shared activities assigned with melds, phase-aware
- [x] **Phases system** (migration 003): Icebreaker → Creative → Finale
- [x] **Teams system** (migration 004): Random animal emoji teams, admin-generated
- [x] **3-digit codes** (migration 005): Changed from 4-digit alphanumeric
- [x] **Prepopulated guests** (migration 006): Bulk CSV upload with intro_text + photos
- [x] **Points system** (migration 007): Automatic scoring + manual admin ledger
- [x] **Profile page**: Edit nickname/photo, view completed melds with detail modal
- [x] **Guest lookup modal**: See guest profile before sending invite
- [x] **Cancel meld**: Cancel accepted melds with confirmation dialog
- [x] **Reclaim login**: Re-login to existing account via code
- [x] **Admin expansions**: Phases, Activities, Teams, Points tabs
- [x] **Simplified prompt display**: "Your words are: X + Y" format (replaced separate boxes)
- [x] **Meld detail modal**: Tappable completed melds in profile + showcase
- [x] **Activity categories v2** (migration 008): 4 categories (drawing/pose/craft/photo) with emoji display, photo activities skip word prompts
- [x] **Remix phase** (migration 009): Phase 2 where players remix completed Source melds instead of getting word prompts. Remix bonds reference a random completed Source bond, display its photo, use teal/cyan UI theme, curved graph edges, max 1 remix per pair, per-phase deduplication for scoring
- [x] **Showcase Awards tab**: Superlatives/awards ceremony view computed from game data (Champion, Social Butterfly, Lightning Melder, Remix Master, Dream Team). 3-way toggle replaces old Network/Teams toggle. Card slideshow with fly transitions, arrow nav + keyboard support

---

## Environment Variables

```bash
# .env
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## Commands

```bash
# Development
npm run dev

# Type checking
npm run check

# Build
npm run build

# Preview production build
npm run preview

# Load testing
npm run load-test http://localhost:5173      # Local
npm run load-test https://megamindmeld.vercel.app       # Production
```

---

## Notes for Future Sessions

- Phase 2 (Remix) is now implemented - players remix completed Source melds
- Guest count: 40-55 expected
- NFC tags pre-programmed with unique URLs
- Consider QR code fallbacks for phones without NFC
- **Simplified UI**: No tabs - Meld page is the single main experience
- **Naming**: UI uses "Meld/Melding" but internal code/DB still uses "bond/bonds" for stability
- **Codes**: 3-digit numeric (000-999), validated with `^[0-9]{3}$`
