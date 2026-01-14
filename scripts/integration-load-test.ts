/**
 * Integration Load Test for The Gooeb
 * Creates real users and bonds to test the full flow
 *
 * Usage:
 *   npx tsx scripts/integration-load-test.ts
 *
 * This test:
 * 1. Creates test mask codes in the database
 * 2. Registers users with those codes
 * 3. Creates bonds between users (~1 per second for 1 minute)
 * 4. Completes bonds with placeholder images
 * 5. Cleans up test data when done
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Configuration
const BASE_URL = process.argv[2] || 'http://localhost:5173';
const BONDS_PER_MINUTE = 60; // ~1 per second
const TEST_DURATION_MS = 60_000;
const NUM_USERS = 20; // Create 20 test users

// Supabase client with service role for direct DB access
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Tiny 1x1 red PNG as base64 (placeholder image)
const PLACEHOLDER_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

interface TestUser {
  code: string;
  maskCodeId: string;
  guestId?: string;
  nickname: string;
}

interface TestResult {
  action: string;
  success: boolean;
  duration: number;
  error?: string;
}

const results: TestResult[] = [];
const testUsers: TestUser[] = [];
let eventId: string;

async function timedAction<T>(action: string, fn: () => Promise<T>): Promise<{ result?: T; success: boolean }> {
  const start = Date.now();
  try {
    const result = await fn();
    results.push({ action, success: true, duration: Date.now() - start });
    return { result, success: true };
  } catch (error) {
    results.push({
      action,
      success: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return { success: false };
  }
}

async function setup(): Promise<boolean> {
  console.log('\n🔧 Setting up test data...\n');

  // Get active event
  const { data: events } = await supabase
    .from('events')
    .select('id')
    .eq('is_active', true)
    .limit(1);

  if (!events || events.length === 0) {
    console.error('No active event found! Please create one first.');
    return false;
  }

  eventId = events[0].id;
  console.log(`   Using event: ${eventId}`);

  // Get existing unclaimed mask codes
  console.log(`   Fetching ${NUM_USERS} unclaimed mask codes...`);

  const { data: availableCodes, error: codesError } = await supabase
    .from('mask_codes')
    .select('id, code')
    .eq('event_id', eventId)
    .eq('is_claimed', false)
    .limit(NUM_USERS);

  if (codesError || !availableCodes || availableCodes.length < 2) {
    console.error('Not enough unclaimed mask codes available!');
    console.error(`Found: ${availableCodes?.length || 0}, need at least 2`);
    return false;
  }

  // Create test users from available codes
  for (let i = 0; i < availableCodes.length; i++) {
    const maskCode = availableCodes[i];
    testUsers.push({
      code: maskCode.code,
      maskCodeId: maskCode.id,
      nickname: `LoadTest${i}`
    });
  }

  console.log(`   Found ${testUsers.length} available codes\n`);
  return testUsers.length >= 2;
}

async function registerUser(user: TestUser): Promise<boolean> {
  const { success, result } = await timedAction(`register:${user.code}`, async () => {
    const response = await fetch(`${BASE_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname: user.nickname,
        photoDataUrl: PLACEHOLDER_IMAGE,
        maskCodeId: user.maskCodeId,
        eventId: eventId,
        code: user.code
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`HTTP ${response.status}: ${error.message}`);
    }

    return response.json();
  });

  if (success && result) {
    user.guestId = (result as { guestId: string }).guestId;
  }

  return success;
}

async function createBond(userA: TestUser, userB: TestUser): Promise<string | null> {
  // User A sends invite to User B
  const { success: inviteSuccess, result: inviteResult } = await timedAction(
    `invite:${userA.code}->${userB.code}`,
    async () => {
      const response = await fetch(`${BASE_URL}/api/bond/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `gooeb_code=${userA.code}`
        },
        body: JSON.stringify({ targetCode: userB.code })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(`HTTP ${response.status}: ${error.message}`);
      }

      return response.json();
    }
  );

  if (!inviteSuccess || !inviteResult) return null;

  const bondId = (inviteResult as { bondId: string }).bondId;

  // Check if it was auto-accepted (mutual tap simulation)
  if ((inviteResult as { autoAccepted?: boolean }).autoAccepted) {
    return bondId;
  }

  // User B accepts the invite
  const { success: acceptSuccess } = await timedAction(
    `accept:${userB.code}`,
    async () => {
      const response = await fetch(`${BASE_URL}/api/bond/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `gooeb_code=${userB.code}`
        },
        body: JSON.stringify({ bondId })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(`HTTP ${response.status}: ${error.message}`);
      }

      return response.json();
    }
  );

  return acceptSuccess ? bondId : null;
}

async function completeBond(bondId: string, user: TestUser): Promise<boolean> {
  const { success } = await timedAction(`complete:${bondId}`, async () => {
    const response = await fetch(`${BASE_URL}/api/bond/${bondId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `gooeb_code=${user.code}`
      },
      body: JSON.stringify({ photoDataUrl: PLACEHOLDER_IMAGE })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`HTTP ${response.status}: ${error.message}`);
    }

    return response.json();
  });

  return success;
}

async function cleanup(): Promise<void> {
  console.log('\n🧹 Cleaning up test data...\n');

  // Get all test guest IDs
  const guestIds = testUsers.map(u => u.guestId).filter(Boolean) as string[];

  if (guestIds.length > 0) {
    // Get bond IDs first for photo cleanup
    const { data: bonds } = await supabase
      .from('bonds')
      .select('id')
      .or(guestIds.map(id => `guest_a_id.eq.${id},guest_b_id.eq.${id}`).join(','));

    // Delete bonds involving test users
    await supabase
      .from('bonds')
      .delete()
      .or(guestIds.map(id => `guest_a_id.eq.${id},guest_b_id.eq.${id}`).join(','));

    // Delete test guests
    await supabase
      .from('guests')
      .delete()
      .in('id', guestIds);

    // Delete guest photos from storage
    const guestPhotoPaths = guestIds.map(id => `guests/${id}.png`);
    await supabase.storage.from('photos').remove(guestPhotoPaths);

    // Delete bond photos from storage
    if (bonds && bonds.length > 0) {
      const bondPhotoPaths: string[] = [];
      for (const bond of bonds) {
        for (const guestId of guestIds) {
          bondPhotoPaths.push(`bonds/${bond.id}_${guestId}.png`);
        }
      }
      await supabase.storage.from('photos').remove(bondPhotoPaths);
    }

    console.log(`   Deleted ${guestIds.length} guests and ${bonds?.length || 0} bonds`);
  }

  // Reset mask codes
  const maskCodeIds = testUsers.map(u => u.maskCodeId);
  await supabase
    .from('mask_codes')
    .update({ is_claimed: false, claimed_at: null })
    .in('id', maskCodeIds);

  console.log('   Cleanup complete\n');
}

function generateReport(): void {
  console.log('\n📊 Results');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`Total operations: ${results.length}`);
  console.log(`Successful: ${successful.length} (${((successful.length / results.length) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${failed.length} (${((failed.length / results.length) * 100).toFixed(1)}%)`);

  // Group by action type
  const byType = new Map<string, TestResult[]>();
  for (const r of results) {
    const type = r.action.split(':')[0];
    const existing = byType.get(type) || [];
    existing.push(r);
    byType.set(type, existing);
  }

  console.log('\n⏱️  By Operation Type');
  for (const [type, typeResults] of byType) {
    const durations = typeResults.map(r => r.duration);
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const successCount = typeResults.filter(r => r.success).length;
    console.log(`   ${type}: ${typeResults.length} ops | ${successCount} success | Avg: ${avg.toFixed(0)}ms`);
  }

  // Show errors
  if (failed.length > 0) {
    console.log('\n❌ Errors (first 10)');
    const errorSample = failed.slice(0, 10);
    for (const f of errorSample) {
      console.log(`   ${f.action}: ${f.error}`);
    }
    if (failed.length > 10) {
      console.log(`   ... and ${failed.length - 10} more errors`);
    }
  }

  // Bonds stats
  const bondOps = results.filter(r => r.action.startsWith('invite:') || r.action.startsWith('accept:') || r.action.startsWith('complete:'));
  const completedBonds = results.filter(r => r.action.startsWith('complete:') && r.success).length;

  console.log('\n🤝 Bond Statistics');
  console.log(`   Total bond operations: ${bondOps.length}`);
  console.log(`   Completed bonds: ${completedBonds}`);

  // Verdict
  const successRate = (successful.length / results.length) * 100;
  console.log('\n🎯 Verdict');
  if (successRate >= 95) {
    console.log('   ✅ EXCELLENT - System handles the load well!');
  } else if (successRate >= 80) {
    console.log('   ⚠️  ACCEPTABLE - Some issues but mostly working.');
  } else {
    console.log('   ❌ NEEDS WORK - Review errors above.');
  }
  console.log('\n');
}

async function runTest(): Promise<void> {
  console.log('\n🎭 The Gooeb Integration Load Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Test users: ${NUM_USERS}`);
  console.log(`Target: ~${BONDS_PER_MINUTE} bonds/minute\n`);

  // Setup
  const setupOk = await setup();
  if (!setupOk) {
    console.error('Setup failed!');
    return;
  }

  // Register all users
  console.log('📝 Registering users...\n');
  for (const user of testUsers) {
    const success = await registerUser(user);
    process.stdout.write(success ? '.' : 'x');
  }
  console.log('\n');

  const registeredUsers = testUsers.filter(u => u.guestId);
  console.log(`   Registered: ${registeredUsers.length}/${testUsers.length}\n`);

  if (registeredUsers.length < 2) {
    console.error('Not enough users registered!');
    await cleanup();
    return;
  }

  // Create bonds at ~1 per second
  console.log('🤝 Creating bonds (~1/second for 60 seconds)...\n');

  const startTime = Date.now();
  let bondCount = 0;
  const delayBetweenBonds = TEST_DURATION_MS / BONDS_PER_MINUTE;

  // Create pairs for bonding
  const pairs: [TestUser, TestUser][] = [];
  for (let i = 0; i < registeredUsers.length; i++) {
    for (let j = i + 1; j < registeredUsers.length; j++) {
      pairs.push([registeredUsers[i], registeredUsers[j]]);
    }
  }

  // Shuffle pairs for variety
  pairs.sort(() => Math.random() - 0.5);

  let pairIndex = 0;

  while (Date.now() - startTime < TEST_DURATION_MS && pairIndex < pairs.length) {
    const [userA, userB] = pairs[pairIndex];

    // Create and complete bond
    const bondId = await createBond(userA, userB);
    if (bondId) {
      await completeBond(bondId, userA);
      bondCount++;
    }

    pairIndex++;

    // Progress indicator
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    process.stdout.write(`\r   ${elapsed}s | ${bondCount} bonds created`);

    // Delay to achieve target rate
    const targetBonds = Math.floor((Date.now() - startTime) / delayBetweenBonds);
    if (bondCount >= targetBonds) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBonds / 2));
    }
  }

  console.log('\n');

  // Generate report
  generateReport();

  // Cleanup
  await cleanup();
}

// Run the test
runTest().catch(console.error);
