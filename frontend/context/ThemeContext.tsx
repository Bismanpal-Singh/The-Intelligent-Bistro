import React, { createContext, useContext, useState } from 'react';
import { DarkColors, LightColors, ThemeColors } from '../constants/theme';

type ThemeContextType = {
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType>({
  isDark: true,
  colors: DarkColors,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  return (
    <ThemeContext.Provider
      value={{
        isDark,
        colors: isDark ? DarkColors : LightColors,
        toggleTheme: () => setIsDark((v) => !v),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
