import type { ScoringRule } from './types';

export const SCORING_RULES: Record<string, ScoringRule> = {
	meldCompleted: {
		id: 'meldCompleted',
		label: 'Completed Meld',
		pointsPerUnit: 5
	},
	meldAccepted: {
		id: 'meldAccepted',
		label: 'Accepted Meld',
		pointsPerUnit: 1
	}
};
