import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { storage } from '../api';

const THEME_KEY = 'cleancity_theme';
const ThemeContext = createContext(null);

// Categorical slots (fixed order) and chart chrome, stepped separately for each mode.
const CHART = {
  light: {
    series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
    grid: '#e1e0d9',
    axis: '#c3c2b7',
    tick: '#898781',
    surface: '#fcfcfb',
    text: '#0b0b0b',
    textMuted: '#52514e',
    target: '#52514e',
  },
  dark: {
    series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
    grid: '#2c2c2a',
    axis: '#383835',
    tick: '#898781',
    surface: '#1a1a19',
    text: '#f0efec',
    textMuted: '#c3c2b7',
    target: '#c3c2b7',
  },
};

const systemDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches;

export function ThemeProvider({ children }) {
  const [pref, setPref] = useState(() => storage.get(THEME_KEY));
  const [sysDark, setSysDark] = useState(systemDark);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const fn = (e) => setSysDark(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  const theme = pref || (sysDark ? 'dark' : 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      chart: CHART[theme],
      toggle: () => {
        const next = theme === 'dark' ? 'light' : 'dark';
        storage.set(THEME_KEY, next);
        setPref(next);
      },
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

// Waste streams always map to the same categorical slot, in this order.
export const STREAMS = [
  { key: 'dry', label: 'Dry', slot: 0 },
  { key: 'mixed', label: 'Mixed', slot: 1 },
  { key: 'wet', label: 'Wet', slot: 2 },
  { key: 'hazardous', label: 'Hazardous', slot: 3 },
  { key: 'eWaste', label: 'E-Waste', slot: 4 },
];

export function useStreamColors() {
  const { chart } = useTheme();
  return useMemo(() => Object.fromEntries(STREAMS.map((s) => [s.key, chart.series[s.slot]])), [chart]);
}
