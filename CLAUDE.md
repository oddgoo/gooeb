# CLAUDE.md - The Gooeb Project Guide

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

**The Gooeb** is a real-time multiplayer party game about bonding creatively. Played on guests' phones during a ~3 hour birthday party with 40-55 guests.

### Core Concept
- Guests wear masks with NFC tags pre-programmed with unique 4-digit codes
- Guests register via NFC tap, QR code, or manual code entry
- The game has phases where guests bond with each other through prompts
- A showcase display shows a real-time network graph of all bonds

---

## Technical Requirements

### Tech Stack
- **Frontend**: SvelteKit 5 + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Realtime + Storage)
- **Graph Visualization**: vis.js (Network)
- **Deployment**: Vercel

### App Structure
**Simplified single-page app** - The Bond page is the main experience. No tabs.

- `/` - Landing page (unauthenticated) → redirects to `/bond` if authenticated
- `/bond` - Main bonding interface (authenticated)
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

### Phase 1 - Bonding
- Goal: Connect with others by tapping each other's NFC tags or entering codes
- **Invite Flow**:
  1. Player A taps Player B's tag (or enters code)
  2. Server checks if code is registered
  3. Creates "bond invitation" (pending state)
  4. Player B sees invite on Bond page
  5. Player B taps Player A's tag to confirm
- **Word Prompt System**:
  - On confirmation, both players receive a random **word prompt**
  - Three categories: **character**, **theme**, **place**
    - **Character**: Roles/archetypes (Pirate, Robot, Wizard, etc.)
    - **Theme**: Concepts/emotions (Chaos, Love, Mystery, etc.)
    - **Place**: Locations/settings (Underwater, Moon, Disco, etc.)
  - **Category non-repetition**: Between any two people, categories cannot repeat
    - If A & B already did a "character" prompt, their next bond uses "theme" or "place"
    - Max 3 bonds possible between same pair (one per category)
- Any player submits photo of completion, other confirms
- Server stores: completion photo, prompt word + category, participants

### Phase 2 - Remix (Future)
- System assigns groups instead of 1:1 bonding
- Groups remix/reinterpret results from Phase 1 prompts
- **Not implemented yet - focus on Phase 1 first**

### Admin View
- Manipulate and moderate the game
- Manage guests, bonds, prompts
- Override/delete problematic content

### Showcase View (Big Screen Display)
- Real-time vis.js network graph showing all bonds
- Slideshow of submitted photos
- Confetti when new connections appear
- Leaderboard of most bonds
- Collaborative goal tracker (bonds done / all possible combinations)

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

### Bond Statuses
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
- Multiple bonds allowed between same pair (up to 3, one per category)
- Category non-repetition enforced in application logic when assigning prompts
- Supabase Realtime enabled on `bonds` and `guests` tables

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
│   │   │   └── bond/                 # Bond APIs
│   │   │       ├── invite/           # Send bond invite
│   │   │       ├── accept/           # Accept invite
│   │   │       ├── reject/           # Reject invite
│   │   │       ├── list/             # List user's bonds
│   │   │       └── [id]/complete/    # Complete bond with photo
│   │   ├── (app)/                    # Protected routes
│   │   │   ├── +layout.server.ts     # Auth guard
│   │   │   ├── +layout.svelte        # App shell
│   │   │   ├── bond/+page.svelte     # Main bonding interface
│   │   │   └── bond/[id]/complete/   # Bond completion page
│   │   ├── showcase/                 # (Session 4)
│   │   └── admin/                    # (Session 4)
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts             # Browser Supabase client
│   │   │   ├── server.ts             # Server Supabase client
│   │   │   └── types.ts              # Database types
│   │   ├── stores/
│   │   │   ├── auth.ts               # Auth state
│   │   │   └── bonds.ts              # Bonds state + realtime
│   │   ├── components/
│   │   │   ├── PhotoCapture.svelte   # Camera + upload
│   │   │   └── NetworkGraph.svelte   # (Session 4)
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
| 2 | Bonding mechanics (invite/accept/prompts) | ✅ COMPLETE |
| 3 | Photo upload, completion flow | ✅ COMPLETE |
| 4 | Showcase + Admin views | 🔲 NOT STARTED |
| 5 | Polish + Deploy | 🔲 NOT STARTED |

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
- [x] Bond page with user info header + invite form
- [x] Authenticated users redirect from `/` to `/bond`
- [x] Build passing, types checking

**Simplified (removed/changed):**
- ~~Tab navigation (Me, Bond, Web)~~ → Single Bond page is the main experience
- ~~Me page~~ → User info shown in Bond page header
- ~~Web page~~ → Network graph only in Showcase view
- ~~Auth tokens~~ → Using mask codes directly (stored in cookie + localStorage)

**Pending Setup (before Session 2):**
- [x] Create Supabase project at supabase.com
- [x] Run migration SQL in Supabase SQL Editor
- [x] Create `photos` storage bucket (public)
- [x] Update `.env` with real Supabase credentials

### Session 2 - COMPLETE ✅

**Completed:**
- [x] Bonds store with realtime Supabase subscriptions (`src/lib/stores/bonds.ts`)
- [x] Bond invite API endpoint (`/api/bond/invite`)
- [x] Bond accept API with prompt assignment (`/api/bond/accept`)
- [x] Bond reject API endpoint (`/api/bond/reject`)
- [x] Bond list API endpoint (`/api/bond/list`)
- [x] Prompt assignment with category non-repetition (max 3 bonds per pair)
- [x] Pending incoming invites with Accept/Decline buttons
- [x] Pending outgoing invites display
- [x] Active bond prompt view with emoji + word display
- [x] Completed bonds list
- [x] Realtime updates via Supabase subscriptions
- [x] 4-digit numeric codes (changed from alphanumeric)

### Session 3 - COMPLETE ✅

**Completed:**
- [x] Photo capture for bond completion (`/bond/[id]/complete` page)
- [x] Bond completion API endpoint (`/api/bond/[id]/complete`)
- [x] Bond completion page with Win3.1 retro styling
- [x] Completed bonds list on Bond page (already in Session 2)
- [x] Photo upload to Supabase Storage (`bonds/{id}.jpg`)

### Session 4 - NOT STARTED 🔲

**Planned:**
- [ ] NetworkGraph component with vis.js
- [ ] Showcase page (optimised for 16 by 9) with graph, slideshow, leaderboard
- [ ] Admin page with guest/bond/prompt management
- [ ] Admin API endpoints

### Session 5 - NOT STARTED 🔲

**Planned:**
- [ ] Error handling polish
- [ ] Vercel deployment
- [ ] Environment variables in Vercel
- [ ] Load testing
- [ ] Pre-party checklist completion

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
```

---

## Notes for Future Sessions

- Phase 2 (Remix) is explicitly deferred - focus on Phase 1 being rock solid
- Timeline: 17 days until party (as of session start)
- Guest count: 40-55 expected
- NFC tags will be pre-programmed with unique URLs
- Consider QR code fallbacks for phones without NFC
- **Simplified UI**: No tabs - Bond page is the single main experience
