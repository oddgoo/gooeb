import type { Config } from 'tailwindcss';

export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				// Y2K / Early 2000s color palette
				win: {
					bg: '#FFF5F8',         // Light pink window background
					title: '#FFB800',      // Yellow/gold title bar
					titleActive: '#FFB800',
					titleInactive: '#E0A000',
					btnFace: '#FFE4EC',    // Light pink button face
					btnHighlight: '#FFFFFF',
					btnShadow: '#FFB6C1',  // Light pink shadow
					btnDkShadow: '#FF69B4', // Hot pink dark shadow
					window: '#FFFFFF',
					desktop: '#B4E4FF',    // Light sky blue desktop
					text: '#4A154B',       // Dark purple text
					textDisabled: '#C0A0C0',
					highlight: '#FF69B4',  // Hot pink highlight
					highlightText: '#FFFFFF',
				},
				// Y2K accent colors
				y2k: {
					pink: '#FF69B4',       // Hot pink
					magenta: '#FF1493',    // Deep pink
					cyan: '#00D4AA',       // Turquoise
					yellow: '#FFD700',     // Gold
					orange: '#FFA500',     // Orange
					sky: '#87CEEB',        // Sky blue
					lavender: '#E6E6FA',   // Lavender
				},
				// Keep gooeb for fallback
				gooeb: {
					50: '#faf5ff',
					100: '#f3e8ff',
					200: '#e9d5ff',
					300: '#d8b4fe',
					400: '#c084fc',
					500: '#a855f7',
					600: '#9333ea',
					700: '#7c3aed',
					800: '#6b21a8',
					900: '#581c87'
				}
			},
			fontFamily: {
				'win': ['"MS Sans Serif"', '"Pixelated MS Sans Serif"', 'Arial', 'sans-serif'],
			},
			boxShadow: {
				'win-out': 'inset -1px -1px 0 #000000, inset 1px 1px 0 #FFFFFF, inset -2px -2px 0 #808080, inset 2px 2px 0 #DFDFDF',
				'win-in': 'inset 1px 1px 0 #000000, inset -1px -1px 0 #FFFFFF, inset 2px 2px 0 #808080, inset -2px -2px 0 #DFDFDF',
				'win-btn': 'inset -1px -1px 0 #000000, inset 1px 1px 0 #FFFFFF, inset -2px -2px 0 #808080, inset 2px 2px 0 #DFDFDF',
				'win-btn-pressed': 'inset 1px 1px 0 #000000, inset -1px -1px 0 #FFFFFF, inset 2px 2px 0 #808080',
			}
		}
	},
	plugins: []
} satisfies Config;
