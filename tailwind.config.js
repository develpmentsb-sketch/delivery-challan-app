/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#1B2A4A',
          50: '#EEF1F7',
          100: '#D6DCEA',
          200: '#AEB9D5',
          300: '#8596C0',
          400: '#5D73AB',
          500: '#3A4F86',
          600: '#2A3C6B',
          700: '#1B2A4A',
          800: '#141F38',
          900: '#0D1526'
        },
        cream: {
          DEFAULT: '#FBF9F4',
          100: '#FFFFFF',
          200: '#FBF9F4',
          300: '#F3EFE3',
          400: '#EAE3D0'
        },
        gold: {
          DEFAULT: '#C98A2C',
          50: '#FBF0DF',
          100: '#F5E1BE',
          400: '#DBA254',
          500: '#C98A2C',
          600: '#A16E1F'
        },
        forest: {
          DEFAULT: '#2F6846',
          50: '#E8F2EC',
          100: '#C7E0D1',
          500: '#2F6846',
          600: '#254F35'
        },
        brick: {
          DEFAULT: '#B23A34',
          50: '#F8E6E5',
          100: '#EFC1BE',
          500: '#B23A34',
          600: '#8E2E29'
        }
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        display: ['"Sora"', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        card: '0 1px 2px rgba(27,42,74,0.06), 0 1px 3px rgba(27,42,74,0.08)'
      }
    }
  },
  plugins: []
}
