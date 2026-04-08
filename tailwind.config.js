export default {
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                bg: {
                    primary: "var(--bg-primary)",
                    secondary: "var(--bg-secondary)",
                    tertiary: "var(--bg-tertiary)",
                },
                text: {
                    primary: "var(--text-primary)",
                    secondary: "var(--text-secondary)",
                },
                accent: {
                    green: "var(--accent-green)",
                    red: "var(--accent-red)",
                    blue: "var(--accent-blue)",
                    yellow: "var(--accent-yellow)",
                    purple: "var(--accent-purple)",
                },
                border: {
                    primary: "var(--border-primary)",
                },
            },
            fontFamily: {
                sans: ["Inter", "system-ui", "sans-serif"],
                mono: ["JetBrains Mono", "Consolas", "monospace"],
            },
        },
    },
    plugins: [],
};
