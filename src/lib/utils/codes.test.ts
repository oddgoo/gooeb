import { describe, it, expect } from 'vitest';
import { formatCode, validateCode, generateCode, displayCode } from './codes';

describe('formatCode', () => {
	it('removes non-digit characters', () => {
		expect(formatCode('12ab34')).toBe('1234');
		expect(formatCode('a1b2c3d4')).toBe('1234');
	});

	it('limits to 4 digits', () => {
		expect(formatCode('123456789')).toBe('1234');
	});

	it('handles empty input', () => {
		expect(formatCode('')).toBe('');
	});

	it('keeps valid digits', () => {
		expect(formatCode('5678')).toBe('5678');
		expect(formatCode('0000')).toBe('0000');
	});
});

describe('validateCode', () => {
	it('accepts valid 4-digit codes', () => {
		expect(validateCode('1234')).toBe(true);
		expect(validateCode('0000')).toBe(true);
		expect(validateCode('9999')).toBe(true);
	});

	it('rejects codes that are too short', () => {
		expect(validateCode('123')).toBe(false);
		expect(validateCode('1')).toBe(false);
		expect(validateCode('')).toBe(false);
	});

	it('rejects codes that are too long', () => {
		expect(validateCode('12345')).toBe(false);
	});

	it('rejects codes with non-digits', () => {
		expect(validateCode('123a')).toBe(false);
		expect(validateCode('ABCD')).toBe(false);
	});
});

describe('generateCode', () => {
	it('generates a 4-digit string', () => {
		const code = generateCode();
		expect(code).toMatch(/^[0-9]{4}$/);
	});

	it('pads with leading zeros', () => {
		// Run multiple times to increase chance of hitting low numbers
		for (let i = 0; i < 100; i++) {
			const code = generateCode();
			expect(code.length).toBe(4);
		}
	});
});

describe('displayCode', () => {
	it('pads short codes with leading zeros', () => {
		expect(displayCode('1')).toBe('0001');
		expect(displayCode('12')).toBe('0012');
		expect(displayCode('123')).toBe('0123');
	});

	it('leaves 4-digit codes unchanged', () => {
		expect(displayCode('1234')).toBe('1234');
		expect(displayCode('0000')).toBe('0000');
	});
});
