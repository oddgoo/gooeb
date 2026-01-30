import { describe, it, expect } from 'vitest';
import { formatCode, validateCode, generateCode, displayCode } from './codes';

describe('formatCode', () => {
	it('removes non-digit characters', () => {
		expect(formatCode('12ab3')).toBe('123');
		expect(formatCode('a1b2c3')).toBe('123');
	});

	it('limits to 3 digits', () => {
		expect(formatCode('123456789')).toBe('123');
	});

	it('handles empty input', () => {
		expect(formatCode('')).toBe('');
	});

	it('keeps valid digits', () => {
		expect(formatCode('567')).toBe('567');
		expect(formatCode('000')).toBe('000');
	});
});

describe('validateCode', () => {
	it('accepts valid 3-digit codes', () => {
		expect(validateCode('123')).toBe(true);
		expect(validateCode('000')).toBe(true);
		expect(validateCode('999')).toBe(true);
	});

	it('rejects codes that are too short', () => {
		expect(validateCode('12')).toBe(false);
		expect(validateCode('1')).toBe(false);
		expect(validateCode('')).toBe(false);
	});

	it('rejects codes that are too long', () => {
		expect(validateCode('1234')).toBe(false);
	});

	it('rejects codes with non-digits', () => {
		expect(validateCode('12a')).toBe(false);
		expect(validateCode('ABC')).toBe(false);
	});
});

describe('generateCode', () => {
	it('generates a 3-digit string', () => {
		const code = generateCode();
		expect(code).toMatch(/^[0-9]{3}$/);
	});

	it('pads with leading zeros', () => {
		// Run multiple times to increase chance of hitting low numbers
		for (let i = 0; i < 100; i++) {
			const code = generateCode();
			expect(code.length).toBe(3);
		}
	});
});

describe('displayCode', () => {
	it('pads short codes with leading zeros', () => {
		expect(displayCode('1')).toBe('001');
		expect(displayCode('12')).toBe('012');
	});

	it('leaves 3-digit codes unchanged', () => {
		expect(displayCode('123')).toBe('123');
		expect(displayCode('000')).toBe('000');
	});
});
