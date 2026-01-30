export type ScoringRule = {
	id: string;
	label: string;
	pointsPerUnit: number;
};

export type PointBreakdown = {
	ruleId: string;
	label: string;
	count: number;
	pointsPerUnit: number;
	totalPoints: number;
};

export type GuestPoints = {
	guestId: string;
	totalPoints: number;
	breakdown: PointBreakdown[];
};

export type LeaderboardEntry = {
	id: string;
	nickname: string;
	photo_url: string;
	points: number;
	bondCount: number;
};

export type LedgerEntry = {
	id: string;
	guest_id: string;
	points: number;
	reason: string;
	created_at: string;
};
