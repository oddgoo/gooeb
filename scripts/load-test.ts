/**
 * Load Testing Script for The Gooeb
 * Simulates 40-55 concurrent users performing typical actions
 *
 * Usage:
 *   npx tsx scripts/load-test.ts https://your-app.vercel.app
 *   npx tsx scripts/load-test.ts http://localhost:5173  # for local testing
 */

const BASE_URL = process.argv[2] || 'http://localhost:5173';
const NUM_USERS = 30;
const TEST_DURATION_MS = 60_000; // 1 minute test

interface TestResult {
  endpoint: string;
  status: number;
  duration: number;
  success: boolean;
  error?: string;
}

const results: TestResult[] = [];
let activeRequests = 0;

async function timedFetch(url: string, options?: RequestInit): Promise<TestResult> {
  const start = Date.now();
  const endpoint = url.replace(BASE_URL, '');

  try {
    activeRequests++;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    const duration = Date.now() - start;

    return {
      endpoint,
      status: response.status,
      duration,
      success: response.ok,
    };
  } catch (error) {
    return {
      endpoint,
      status: 0,
      duration: Date.now() - start,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    activeRequests--;
  }
}

// Simulate a user session
async function simulateUser(userId: number): Promise<void> {
  const userCode = String(1000 + userId).slice(-4); // Generate 4-digit codes

  // 1. Load landing page
  results.push(await timedFetch(`${BASE_URL}/`));

  // 2. Try to join with a code (simulates NFC tap)
  results.push(await timedFetch(`${BASE_URL}/join/${userCode}`));

  // 3. Load bond page (simulates authenticated user)
  results.push(await timedFetch(`${BASE_URL}/bond`));

  // 4. Fetch bonds list API
  results.push(await timedFetch(`${BASE_URL}/api/bond/list`, {
    method: 'GET',
    headers: { Cookie: `gooeb_code=${userCode}` },
  }));

  // 5. Load showcase page
  results.push(await timedFetch(`${BASE_URL}/showcase`));

  // 6. Fetch showcase API
  results.push(await timedFetch(`${BASE_URL}/api/showcase`));

  // Random delay between actions (500ms - 2s)
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1500));
}

async function runLoadTest(): Promise<void> {
  console.log(`\n🎭 The Gooeb Load Test`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Simulated users: ${NUM_USERS}`);
  console.log(`Test duration: ${TEST_DURATION_MS / 1000}s\n`);

  const startTime = Date.now();
  const userPromises: Promise<void>[] = [];

  // Stagger user starts over 10 seconds to simulate realistic arrival
  for (let i = 0; i < NUM_USERS; i++) {
    const delay = (i / NUM_USERS) * 10_000; // Spread over 10 seconds

    const userLoop = async () => {
      await new Promise(resolve => setTimeout(resolve, delay));

      // Each user makes multiple requests over the test duration
      while (Date.now() - startTime < TEST_DURATION_MS) {
        await simulateUser(i);
      }
    };

    userPromises.push(userLoop());
  }

  // Progress indicator
  const progressInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const remaining = Math.max(0, TEST_DURATION_MS / 1000 - elapsed);
    process.stdout.write(`\r⏱️  ${elapsed}s elapsed | ${remaining}s remaining | ${activeRequests} active requests | ${results.length} total requests`);
  }, 1000);

  await Promise.all(userPromises);
  clearInterval(progressInterval);

  // Generate report
  generateReport();
}

function generateReport(): void {
  console.log(`\n\n📊 Results`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`Total requests: ${results.length}`);
  console.log(`Successful: ${successful.length} (${((successful.length / results.length) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${failed.length} (${((failed.length / results.length) * 100).toFixed(1)}%)`);

  // Response time stats
  const durations = results.map(r => r.duration);
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  const sorted = [...durations].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];

  console.log(`\n⏱️  Response Times`);
  console.log(`   Average: ${avg.toFixed(0)}ms`);
  console.log(`   P50: ${p50}ms`);
  console.log(`   P95: ${p95}ms`);
  console.log(`   P99: ${p99}ms`);
  console.log(`   Min: ${Math.min(...durations)}ms`);
  console.log(`   Max: ${Math.max(...durations)}ms`);

  // Per-endpoint breakdown
  console.log(`\n📍 By Endpoint`);
  const byEndpoint = new Map<string, TestResult[]>();
  for (const r of results) {
    const existing = byEndpoint.get(r.endpoint) || [];
    existing.push(r);
    byEndpoint.set(r.endpoint, existing);
  }

  for (const [endpoint, endpointResults] of byEndpoint) {
    const endpointDurations = endpointResults.map(r => r.duration);
    const endpointAvg = endpointDurations.reduce((a, b) => a + b, 0) / endpointDurations.length;
    const endpointSuccess = endpointResults.filter(r => r.success).length;
    console.log(`   ${endpoint}`);
    console.log(`      Requests: ${endpointResults.length} | Success: ${endpointSuccess} | Avg: ${endpointAvg.toFixed(0)}ms`);
  }

  // Errors breakdown
  if (failed.length > 0) {
    console.log(`\n❌ Errors`);
    const errorCounts = new Map<string, number>();
    for (const f of failed) {
      const key = `${f.endpoint}: ${f.error || `HTTP ${f.status}`}`;
      errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
    }
    for (const [error, count] of errorCounts) {
      console.log(`   ${error} (${count}x)`);
    }
  }

  // Verdict
  console.log(`\n🎯 Verdict`);
  const successRate = (successful.length / results.length) * 100;
  if (successRate >= 99 && p95 < 1000) {
    console.log(`   ✅ READY FOR PARTY! High success rate and good response times.`);
  } else if (successRate >= 95 && p95 < 2000) {
    console.log(`   ⚠️  ACCEPTABLE but monitor closely during the party.`);
  } else {
    console.log(`   ❌ NEEDS ATTENTION - Review errors and optimize slow endpoints.`);
  }

  console.log(`\n`);
}

// Run the test
runLoadTest().catch(console.error);
