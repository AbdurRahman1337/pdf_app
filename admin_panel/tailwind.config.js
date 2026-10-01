/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
    theme: {
        extend: {
            colors: {
                dark: {
                    900: '#020617',
                    800: '#0F172A',
                    700: '#1E293B',
                },
                primary: '#38BDF8',
                secondary: '#818CF8',
                accent: '#2DD4BF',
            },
        },
    },
    plugins: [],
}
