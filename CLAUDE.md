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
- Guests wear masks with NFC tags pre-programmed with unique 4-digit codes
- Guests register via NFC tap, QR code, or manual code entry
- The game has phases where guests meld with each other through prompts
- A showcase display shows a real-time network graph of all melds

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
- `/showcase` - Big screen display (public)
- `/admin` - Moderation panel (admin only)

---

## Detailed Requirements

### Setup / Authentication (Simplified)
- Guests receive masks with NFC tags containing URLs like `thegooeb.com/join/XXXX`
- Landing page allows manual 4-digit code entry (or NFC tap, QR scan)
- Registration: nickname + photo upload (camera or file)
- **Simplified auth**: Mask code stored in both localStorage AND cookie (`gooeb_code`)
  - Cookie allows server-side auth validation on page loads
  - localStorage provides client-side access
  - Both are synced by the auth store
- API routes can use the mask code for identification - server looks up guest by code
- No strict security needed - it's a party game!

### Phase 1 - Melding
- Goal: Connect with others by tapping each other's NFC tags or entering codes
- **Invite Flow**:
  1. Player A taps Player B's tag (or enters code)
  2. Server checks if code is registered
  3. Creates "meld invitation" (pending state)
  4. Player B sees invite on Meld page
  5. Player B taps Player A's tag to confirm
- **Word Prompt System**:
  - On confirmation, both players receive a random **word prompt**
  - Three categories: **character**, **theme**, **place**
    - **Character**: Roles/archetypes (Pirate, Robot, Wizard, etc.)
    - **Theme**: Concepts/emotions (Chaos, Love, Mystery, etc.)
    - **Place**: Locations/settings (Underwater, Moon, Disco, etc.)
  - **Category non-repetition**: Between any two people, categories cannot repeat
    - If A & B already did a "character" prompt, their next meld uses "theme" or "place"
    - Max 3 melds possible between same pair (one per category)
- Any player submits photo of completion, other confirms
- Server stores: completion photo, prompt word + category, participants

### Phase 2 - Remix (Future)
- System assigns groups instead of 1:1 melding
- Groups remix/reinterpret results from Phase 1 prompts
- **Not implemented yet - focus on Phase 1 first**

### Admin View
- Manipulate and moderate the game
- Manage guests, melds, prompts
- Override/delete problematic content

### Showcase View (Big Screen Display)
- Real-time vis.js network graph showing all melds
- Slideshow of submitted photos
- Confetti when new connections appear
- Leaderboard of most melds
- Collaborative goal tracker (melds done / all possible combinations)

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
- **events** - id, name, slug, is_active
- **mask_codes** - id, event_id, code (CHAR 4), is_claimed, claimed_at
- **guests** - id, event_id, mask_code_id, nickname, photo_url, auth_token, is_admin
- **prompts** - id, event_id, **word**, **category** (character|theme|place), is_active, times_used
- **bonds** - id, event_id, guest_a_id, guest_b_id, prompt_id, status, photo_url, timestamps

### Meld Statuses (DB column: status)
- `pending` - Invite sent, awaiting acceptance
- `accepted` - Both confirmed, prompt assigned
- `completed` - Photo submitted and confirmed
- `rejected` - Declined by recipient
- `expired` - Timed out

### Prompt Categories
- `character` - Roles/archetypes to embody (15 words seeded)
- `theme` - Abstract concepts/emotions (15 words seeded)
- `place` - Locations/settings (15 words seeded)

### Key Constraints
- Multiple melds allowed between same pair (up to 3, one per category)
- Category non-repetition enforced in application logic when assigning prompts
- Supabase Realtime enabled on `bonds` and `guests` tables (DB table name unchanged)

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
│   │   │   └── bond/                 # Meld APIs (route path unchanged)
│   │   │       ├── invite/           # Send meld invite
│   │   │       ├── accept/           # Accept invite
│   │   │       ├── reject/           # Reject invite
│   │   │       ├── list/             # List user's melds
│   │   │       └── [id]/complete/    # Complete meld with photo
│   │   ├── (app)/                    # Protected routes
│   │   │   ├── +layout.server.ts     # Auth guard
│   │   │   ├── +layout.svelte        # App shell
│   │   │   ├── bond/+page.svelte     # Main melding interface
│   │   │   └── bond/[id]/complete/   # Meld completion page
│   │   ├── showcase/+page.svelte     # Public display (16:9 optimized)
│   │   └── admin/                    # Admin panel (guests/melds/prompts)
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts             # Browser Supabase client
│   │   │   ├── server.ts             # Server Supabase client
│   │   │   └── types.ts              # Database types
│   │   ├── stores/
│   │   │   ├── auth.ts               # Auth state
│   │   │   └── bonds.ts              # Melds state + realtime
│   │   ├── components/
│   │   │   ├── PhotoCapture.svelte   # Camera + upload
│   │   │   └── NetworkGraph.svelte   # vis.js network graph
│   │   └── utils/
│   │       ├── codes.ts              # 4-digit code utilities
│   │       └── image.ts              # Client-side resize
│   └── app.css                       # Tailwind + custom styles
├── supabase/migrations/
│   └── 001_initial_schema.sql
├── .env                              # Local env vars
└── [config files]
```

---

## Implementation Status

### Session Plan

| Session | Focus | Status |
|---------|-------|--------|
| 1 | Project setup, DB schema, auth | ✅ COMPLETE |
| 2 | Melding mechanics (invite/accept/prompts) | ✅ COMPLETE |
| 3 | Photo upload, completion flow | ✅ COMPLETE |
| 4 | Showcase + Admin views | ✅ COMPLETE |
| 5 | Polish + Deploy | 🟡 IN PROGRESS |

### Session 1 - COMPLETE ✅

**Completed:**
- [x] SvelteKit project initialized with TypeScript
- [x] Tailwind CSS configured with custom `gooeb` color palette
- [x] Dependencies installed (supabase-js, uuid, vis-network)
- [x] Database schema SQL created (`supabase/migrations/001_initial_schema.sql`)
- [x] Supabase client utilities (browser + server)
- [x] Auth store with localStorage + cookie persistence
- [x] Landing page with 4-digit code entry
- [x] `/join/[code]` route handling NFC/QR entry
- [x] Registration page with camera capture + file upload
- [x] Client-side image resize utility
- [x] Register API endpoint with race condition protection
- [x] Protected app routes with auth guard
- [x] Meld page with user info header + invite form
- [x] Authenticated users redirect from `/` to `/bond`
- [x] Build passing, types checking

**Simplified (removed/changed):**
- ~~Tab navigation (Me, Bond, Web)~~ → Single Meld page is the main experience
- ~~Me page~~ → User info shown in Meld page header
- ~~Web page~~ → Network graph only in Showcase view
- ~~Auth tokens~~ → Using mask codes directly (stored in cookie + localStorage)

**Pending Setup (before Session 2):**
- [x] Create Supabase project at supabase.com
- [x] Run migration SQL in Supabase SQL Editor
- [x] Create `photos` storage bucket (public)
- [x] Update `.env` with real Supabase credentials

### Session 2 - COMPLETE ✅

**Completed:**
- [x] Melds store with realtime Supabase subscriptions (`src/lib/stores/bonds.ts`)
- [x] Meld invite API endpoint (`/api/bond/invite`)
- [x] Meld accept API with prompt assignment (`/api/bond/accept`)
- [x] Meld reject API endpoint (`/api/bond/reject`)
- [x] Meld list API endpoint (`/api/bond/list`)
- [x] Prompt assignment with category non-repetition (max 3 melds per pair)
- [x] Pending incoming invites with Accept/Decline buttons
- [x] Pending outgoing invites display
- [x] Active meld prompt view with emoji + word display
- [x] Completed melds list
- [x] Realtime updates via Supabase subscriptions
- [x] 4-digit numeric codes (changed from alphanumeric)

### Session 3 - COMPLETE ✅

**Completed:**
- [x] Photo capture for meld completion (`/bond/[id]/complete` page)
- [x] Meld completion API endpoint (`/api/bond/[id]/complete`)
- [x] Meld completion page with Win3.1 retro styling
- [x] Completed melds list on Meld page (already in Session 2)
- [x] Photo upload to Supabase Storage (`bonds/{id}.jpg`)

### Session 4 - COMPLETE ✅

**Completed:**
- [x] NetworkGraph component with vis.js (`src/lib/components/NetworkGraph.svelte`)
- [x] Showcase page with graph, slideshow, leaderboard (`/showcase`)
  - Real-time network graph visualization with guest search
  - Sliding photo carousel of recent melds (click for gallery view)
  - Live leaderboard (top 10 connectors)
  - Stats panel with progress bar
  - Confetti animation + slide-in announcement on new melds
- [x] Showcase API endpoint (`/api/showcase`)
- [x] Admin page with guest/meld/prompt management (`/admin`)
  - Tabbed interface: Guests, Melds, Prompts
  - Delete guests (cascades to melds)
  - Delete melds
  - Add/toggle/delete prompts by category
- [x] Admin API endpoints
  - `/api/admin/guests` - GET, DELETE
  - `/api/admin/bonds` - GET, DELETE
  - `/api/admin/prompts` - GET, POST, PATCH, DELETE

### Session 5 - IN PROGRESS 🟡

**Completed:**
- [x] Load testing script created (`scripts/load-test.ts`)
- [x] Pre-party checklist created (`PRE-PARTY-CHECKLIST.md`)
- [x] `tsx` installed for running TypeScript scripts
- [x] `npm run load-test` command added
- [x] Showcase gallery view (click slideshow to see all meld photos in 6-column grid)
- [x] New Meld Announcement (slide-in/out notification when melds complete)
- [x] Guest Search in showcase (search input in Network.exe, highlights & zooms to guest)
- [x] Rename: "Gooeb" → "Cuauh's Mega Mind Meld Imaginarium OS"
- [x] Rename: "Bond/Bonding" → "Meld/Melding" throughout UI

**In Progress:**
- [ ] Vercel deployment
- [ ] Environment variables in Vercel

**Remaining:**
- [ ] Error handling polish (if needed)
- [ ] Final testing after deployment
- [ ] Fun gifs!
- [ ] check admin controls
- [ ] adjust ui, animation timings, etc.
- [ ] maybe allow anyone to reclaim a sign-in/mask.

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
npm run load-test https://thegooeb.com       # Production
```

---

## Notes for Future Sessions

- Phase 2 (Remix) is explicitly deferred - focus on Phase 1 being rock solid
- Timeline: 17 days until party (as of session start)
- Guest count: 40-55 expected
- NFC tags will be pre-programmed with unique URLs
- Consider QR code fallbacks for phones without NFC
- **Simplified UI**: No tabs - Meld page is the single main experience
- **Naming**: UI uses "Meld/Melding" but internal code/DB still uses "bond/bonds" for stability
