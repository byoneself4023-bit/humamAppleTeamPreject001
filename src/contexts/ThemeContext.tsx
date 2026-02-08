import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'default' | 'jazz' | 'soul';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // 1. Initialize state from localStorage or default
    const [theme, setThemeState] = useState<Theme>(() => {
        const savedTheme = localStorage.getItem('app-theme') as Theme;
        return (['default', 'jazz', 'soul'].includes(savedTheme)) ? savedTheme : 'default';
    });

    // 2. Update logic
    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        localStorage.setItem('app-theme', newTheme);
    };

    const toggleTheme = () => {
        setThemeState((prev: Theme) => {
            if (prev === 'default') return 'jazz';
            if (prev === 'jazz') return 'soul';
            return 'default';
        });
    };

    // 3. Side effect: Apply theme class to document body
    useEffect(() => {
        const root = document.documentElement;

        // Remove old theme classes
        root.classList.remove('theme-default', 'theme-jazz', 'theme-soul');

        // Add new theme class
        root.classList.add(`theme-${theme}`);
        root.setAttribute('data-theme', theme);

        // Soul Theme Background Rotation Logic
        let rotationInterval: NodeJS.Timeout;
        if (theme === 'soul') {
            const bgImages = [
                'soul_bg_new_1.png',
                'soul_bg_new_2.png',
                'soul_bg_new_3.png'
            ];
            let currentIndex = 0;

            const rotateBackground = () => {
                root.style.setProperty('--soul-bg-image', `url("/images/theme/${bgImages[currentIndex]}")`);
                currentIndex = (currentIndex + 1) % bgImages.length;
            };

            // Initial set
            rotateBackground();

            // Rotate every 15 seconds
            rotationInterval = setInterval(rotateBackground, 15000);
        } else {
            root.style.removeProperty('--soul-bg-image');
        }

        return () => {
            if (rotationInterval) clearInterval(rotationInterval);
        };
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
