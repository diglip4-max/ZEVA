import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/router';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

export const ClinicThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>('system');
  const router = useRouter();

  // Load saved theme or default to system
  useEffect(() => {
    const stored = localStorage.getItem('clinicTheme') as Theme | null;
    if (stored) {
      setThemeState(stored);
    } else {
      setThemeState('system');
    }
  }, []);

  // Public-facing /clinic routes that should ALWAYS use light mode (not dashboard pages)
  const publicClinicRoutes = [
    '/clinic/findclinic',
    '/clinic/login-clinic',
    '/clinic/register-clinic',
    '/clinic/forgot-password',
    '/clinic/reset-password',
    '/clinic/review-form',
    '/clinic/enquiry-form',
    '/clinic/appointment-landing',
    '/clinic/appointment-booking',
    '/clinic/job-applicants',
  ];

  // Apply theme class to document element based on theme state and active route
  useEffect(() => {
    const root = document.documentElement;
    const isPublicClinicRoute = publicClinicRoutes.some(
      (route) => router.pathname === route || router.pathname.startsWith(route + '/')
    );
    const isDashboardRoute =
      (router.pathname.startsWith('/clinic') || router.pathname.startsWith('/staff')) &&
      !isPublicClinicRoute;

    const apply = (t: Theme) => {
      if (!isDashboardRoute) {
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
        return;
      }

      if (t === 'light') {
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
      } else if (t === 'dark') {
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
          root.classList.add('dark');
          root.style.colorScheme = 'dark';
        } else {
          root.classList.remove('dark');
          root.style.colorScheme = 'light';
        }
      }
    };

    apply(theme);

    if (theme === 'system' && isDashboardRoute) {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        apply(e.matches ? 'dark' : 'light');
      };
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, [theme, router.pathname]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem('clinicTheme', t);
  };

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setTheme(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useClinicTheme = (): ThemeContextProps => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useClinicTheme must be used within ClinicThemeProvider');
  }
  return context;
};
