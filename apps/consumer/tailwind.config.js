export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#ea5c2a',
        cream: '#fffff5'
      },
      borderRadius: {
        card: '18px'
      },
      boxShadow: {
        soft: '0 2px 8px rgba(0,0,0,0.06)'
      },
      fontFamily: {
        sans: ['system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
