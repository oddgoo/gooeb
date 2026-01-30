import { SCORING_RULES } from './rules';
import type { GuestPoints, LeaderboardEntry, PointBreakdown } from './types';

type BondLike = {
	guest_a_id: string;
	guest_b_id: string;
	status: string;
};

const STATUS_RANK: Record<string, number> = {
	completed: 2,
	accepted: 1
};

/**
 * Deduplicate bonds so only one bond per guest pair is kept.
 * Prefers completed over accepted. Among equal status, keeps the
 * item that appeared first in the input array (caller controls sort order).
 * Works with any object that extends BondLike.
 */
export function deduplicateBonds<T extends BondLike>(bonds: T[]): T[] {
	const best = new Map<string, T>();

	for (const bond of bonds) {
		// Normalize pair key so (A,B) and (B,A) map to the same key
		const pairKey =
			bond.guest_a_id < bond.guest_b_id
				? `${bond.guest_a_id}:${bond.guest_b_id}`
				: `${bond.guest_b_id}:${bond.guest_a_id}`;

		const existing = best.get(pairKey);
		if (!existing) {
			best.set(pairKey, bond);
			continue;
		}

		const existingRank = STATUS_RANK[existing.status] ?? 0;
		const newRank = STATUS_RANK[bond.status] ?? 0;

		if (newRank > existingRank) {
			best.set(pairKey, bond);
		}
		// If equal rank, keep the first one (already in the map)
	}

	return Array.from(best.values());
}

/**
 * Calculate points for all guests from their bonds.
 * Pure function — no DB queries.
 */
export function calculateGuestPoints(bonds: BondLike[]): Map<string, GuestPoints> {
	const map = new Map<string, GuestPoints>();

	function ensure(guestId: string): GuestPoints {
		let gp = map.get(guestId);
		if (!gp) {
			gp = { guestId, totalPoints: 0, breakdown: [] };
			map.set(guestId, gp);
		}
		return gp;
	}

	// Count per-guest per-status
	const counts: Record<string, { accepted: number; completed: number }> = {};

	for (const bond of bonds) {
		for (const guestId of [bond.guest_a_id, bond.guest_b_id]) {
			if (!counts[guestId]) counts[guestId] = { accepted: 0, completed: 0 };
			if (bond.status === 'completed') {
				counts[guestId].completed++;
			} else if (bond.status === 'accepted') {
				counts[guestId].accepted++;
			}
		}
	}

	for (const [guestId, c] of Object.entries(counts)) {
		const gp = ensure(guestId);
		const breakdown: PointBreakdown[] = [];

		if (c.completed > 0) {
			const rule = SCORING_RULES.meldCompleted;
			breakdown.push({
				ruleId: rule.id,
				label: rule.label,
				count: c.completed,
				pointsPerUnit: rule.pointsPerUnit,
				totalPoints: c.completed * rule.pointsPerUnit
			});
		}

		if (c.accepted > 0) {
			const rule = SCORING_RULES.meldAccepted;
			breakdown.push({
				ruleId: rule.id,
				label: rule.label,
				count: c.accepted,
				pointsPerUnit: rule.pointsPerUnit,
				totalPoints: c.accepted * rule.pointsPerUnit
			});
		}

		gp.breakdown = breakdown;
		gp.totalPoints = breakdown.reduce((sum, b) => sum + b.totalPoints, 0);
	}

	return map;
}

type GuestLike = {
	id: string;
	nickname: string;
	photo_url: string;
};

/**
 * Build a sorted leaderboard with points.
 */
export function buildLeaderboard(
	guests: GuestLike[],
	bonds: BondLike[],
	limit = 10
): LeaderboardEntry[] {
	const pointsMap = calculateGuestPoints(bonds);

	// Also count raw bonds per guest for display
	const bondCounts: Record<string, number> = {};
	for (const bond of bonds) {
		bondCounts[bond.guest_a_id] = (bondCounts[bond.guest_a_id] || 0) + 1;
		bondCounts[bond.guest_b_id] = (bondCounts[bond.guest_b_id] || 0) + 1;
	}

	return guests
		.map((guest) => ({
			id: guest.id,
			nickname: guest.nickname,
			photo_url: guest.photo_url,
			points: pointsMap.get(guest.id)?.totalPoints ?? 0,
			bondCount: bondCounts[guest.id] || 0
		}))
		.filter((g) => g.points > 0)
		.sort((a, b) => b.points - a.points)
		.slice(0, limit);
}
