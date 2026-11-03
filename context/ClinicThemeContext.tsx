import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/router';
import { isPublicDoctorProfilePath } from '../config/siteThemeRoutes';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  /** Theme used by the public site (pages without a /clinic, /doctor, /staff, /agent or /admin prefix) */
  siteTheme: Theme;
  setSiteTheme: (theme: Theme) => void;
  toggleSiteTheme: () => void;
  /** Theme actually applied to <html> right now */
  resolvedTheme: 'light' | 'dark';
  /** True when the current route follows the public-site theme (header toggle is available) */
  isSiteThemeRoute: boolean;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

// Separate storage keys so the clinic dashboard theme and the public-site theme never clash
const CLINIC_THEME_KEY = 'clinicTheme';
const SITE_THEME_KEY = 'siteTheme';

export const ClinicThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>('system');
  const [siteTheme, setSiteThemeState] = useState<Theme>('light');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [isSiteThemeRoute, setIsSiteThemeRoute] = useState(false);
  const router = useRouter();

  // Load saved theme or default to system
  useEffect(() => {
    const stored = localStorage.getItem(CLINIC_THEME_KEY) as Theme | null;
    if (stored) {
      setThemeState(stored);
    } else {
      setThemeState('system');
    }
  }, []);

  // Load saved public-site theme (defaults to light so existing pages look unchanged)
  useEffect(() => {
    const stored = localStorage.getItem(SITE_THEME_KEY) as Theme | null;
    if (stored) {
      setSiteThemeState(stored);
    } else {
      setSiteThemeState('light');
    }
  }, []);

  // Public-facing /clinic routes that should ALWAYS use light mode (not dashboard pages)
  const publicClinicRoutes = [
    '/findclinic',
    '/login-clinic',
    '/register-clinic',
    '/clinic/forgot-password',
    '/clinic/reset-password',
    '/clinic/review-form',
    '/clinic/enquiry-form',
    '/clinic/appointment-landing',
    '/clinic/appointment-booking',
    '/clinic/job-applicants',
  ];

  // Route areas that keep their own theme handling and therefore ignore the public-site theme
  const appScopedPrefixes = ['/clinic', '/doctor', '/staff', '/agent', '/admin'];

  const matchesPrefix = (path: string, prefix: string) =>
    path === prefix || path.startsWith(prefix + '/');

  // Apply theme class to document element based on theme state and active route
  useEffect(() => {
    const root = document.documentElement;
    const pathname = router.pathname;
    const isPublicClinicRoute = publicClinicRoutes.some(
      (route) => pathname === route || pathname.startsWith(route + '/')
    );
    const isDashboardRoute =
      (matchesPrefix(pathname, '/clinic') || matchesPrefix(pathname, '/staff')) &&
      !isPublicClinicRoute;

    // Public-site routes: everything outside the clinic / doctor / staff / agent / admin areas,
    // plus public pages that live under such a prefix (the doctor profile page uses the site header)
    const siteRoute =
      !isDashboardRoute &&
      (isPublicDoctorProfilePath(pathname) ||
        !appScopedPrefixes.some((prefix) => matchesPrefix(pathname, prefix)));

    setIsSiteThemeRoute(siteRoute);

    const prefersDark = () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;

    const activeTheme: Theme = isDashboardRoute
      ? theme
      : siteRoute
        ? siteTheme
        : 'light';

    const apply = (t: Theme) => {
      const useDark = t === 'dark' || (t === 'system' && prefersDark());
      if (useDark) {
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
      }
      setResolvedTheme(useDark ? 'dark' : 'light');
    };

    apply(activeTheme);

    // Re-evaluate while the OS preference changes only when a 'system' choice is active
    if (activeTheme === 'system' && (isDashboardRoute || siteRoute)) {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        apply(e.matches ? 'dark' : 'light');
      };
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, [theme, siteTheme, router.pathname]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem(CLINIC_THEME_KEY, t);
  };

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setTheme(next);
  };

  const setSiteTheme = (t: Theme) => {
    setSiteThemeState(t);
    localStorage.setItem(SITE_THEME_KEY, t);
  };

  const toggleSiteTheme = () => {
    const isDark =
      siteTheme === 'dark' ||
      (siteTheme === 'system' &&
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    setSiteTheme(isDark ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        siteTheme,
        setSiteTheme,
        toggleSiteTheme,
        resolvedTheme,
        isSiteThemeRoute,
      }}
    >
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
