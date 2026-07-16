import React, { useMemo } from 'react';
import type { FC, PropsWithChildren } from 'react';
import type { ThemeDropDownValue } from 'components/NavBar/NavBar';
import {
  amoledTheme,
  darkTheme,
  emberTheme,
  glassTheme,
  harborTheme,
  midnightTheme,
  theme,
  ThemeType,
} from 'theme/theme';

interface ThemeModeContextProps {
  isDarkMode: boolean;
  activeTheme: ThemeType;
  themeMode: ThemeDropDownValue;
  setThemeMode: (value: string | number) => void;
}

export const ThemeModeContext = React.createContext<ThemeModeContextProps>({
  isDarkMode: false,
  activeTheme: theme,
  themeMode: 'auto_theme',
  setThemeMode: () => {},
});

export const ThemeModeProvider: FC<PropsWithChildren<unknown>> = ({
  children,
}) => {
  const matchDark = window.matchMedia('(prefers-color-scheme: dark)');
  const [themeMode, setThemeModeState] =
    React.useState<ThemeDropDownValue>('auto_theme');

  React.useLayoutEffect(() => {
    const mode = localStorage.getItem('mode');
    setThemeModeState((mode as ThemeDropDownValue) ?? 'auto_theme');
  }, [setThemeModeState]);

  const isDarkMode = React.useMemo(() => {
    if (themeMode === 'auto_theme') {
      return matchDark.matches;
    }
    return (
      themeMode === 'dark_theme' ||
      themeMode === 'midnight_theme' ||
      themeMode === 'amoled_theme'
    );
  }, [themeMode]);

  const activeTheme = React.useMemo(() => {
    switch (themeMode) {
      case 'dark_theme':
        return darkTheme;
      case 'midnight_theme':
        return midnightTheme;
      case 'harbor_theme':
        return harborTheme;
      case 'ember_theme':
        return emberTheme;
      case 'amoled_theme':
        return amoledTheme;
      case 'glass_theme':
        return glassTheme;
      case 'light_theme':
        return theme;
      case 'auto_theme':
      default:
        return isDarkMode ? darkTheme : theme;
    }
  }, [isDarkMode, themeMode]);

  const setThemeMode = React.useCallback(
    (value: string | number) => {
      setThemeModeState(value as ThemeDropDownValue);
      localStorage.setItem('mode', value as string);
    },
    [setThemeModeState]
  );

  const contextValue = useMemo(
    () => ({
      isDarkMode,
      activeTheme,
      themeMode,
      setThemeMode,
    }),
    [activeTheme, isDarkMode, themeMode, setThemeMode]
  );

  return (
    <ThemeModeContext.Provider value={contextValue}>
      {children}
    </ThemeModeContext.Provider>
  );
};
