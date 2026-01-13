import type { Config } from 'tailwindcss';

export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				// Windows 3.1 color palette
				win: {
					bg: '#C0C0C0',        // Silver background
					title: '#000080',     // Navy blue title bar
					titleActive: '#000080',
					titleInactive: '#808080',
					btnFace: '#C0C0C0',
					btnHighlight: '#FFFFFF',
					btnShadow: '#808080',
					btnDkShadow: '#000000',
					window: '#FFFFFF',
					desktop: '#008080',   // Teal desktop
					text: '#000000',
					textDisabled: '#808080',
					highlight: '#000080',
					highlightText: '#FFFFFF',
				},
				// Keep gooeb for accent
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
