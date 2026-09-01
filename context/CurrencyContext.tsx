// context/CurrencyContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import axios from "axios";
import { getAuthHeaders } from "@/lib/helper";

const CURRENCY_CACHE_KEY = "zeva_clinic_currency";

interface CurrencyContextType {
  currency: string;
  setCurrency: (currency: string) => void;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: "INR",
  setCurrency: () => { },
});

export const useCurrency = (): CurrencyContextType => useContext(CurrencyContext);

interface CurrencyProviderProps {
  children: ReactNode;
}

export const CurrencyProvider: React.FC<CurrencyProviderProps> = ({ children }) => {
  // On mount, immediately read cached currency from localStorage (avoids flash of wrong symbol)
  const [currency, setCurrencyState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(CURRENCY_CACHE_KEY) || "INR";
    }
    return "INR";
  });

  const fetchCurrency = useCallback(async () => {
    try {
      const authHeaders = getAuthHeaders();
      if (!authHeaders) return false; // user not logged in — keep default

      // Use myallClinic API which works for ALL user roles (clinic, agent, doctorStaff, staff, admin, doctor)
      const res = await axios.get("/api/clinics/myallClinic", {
        headers: authHeaders,
      });
      if (res.data.success && res.data.clinic?.currency) {
        const newCurrency = res.data.clinic.currency;
        setCurrencyState(newCurrency);
        // Cache in localStorage so it's available immediately on next page load / navigation
        try { localStorage.setItem(CURRENCY_CACHE_KEY, newCurrency); } catch { }
        return true;
      }
    } catch (error) {
      console.error("Error fetching clinic currency:", error);
      // Keep current value if anything fails
    }
    return false;
  }, []);

  useEffect(() => {
    // Attempt to fetch currency immediately on mount
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;
    const maxRetries = 5;

    const attemptFetch = async () => {
      const success = await fetchCurrency();
      // If auth headers weren't ready yet (just after login redirect), retry after a short delay
      if (!success && retryCount < maxRetries) {
        retryCount++;
        retryTimer = setTimeout(async () => {
          await attemptFetch();
        }, 1500);
      }
    };

    attemptFetch();

    // Listen for storage events — when login stores a token in another tab or
    // when the token is set after navigation, re-fetch the currency
    const handleStorage = (e: StorageEvent) => {
      if (
        e.key &&
        (e.key.includes("Token") || e.key === CURRENCY_CACHE_KEY)
      ) {
        if (e.key === CURRENCY_CACHE_KEY && e.newValue) {
          // Another tab updated the cached currency — just adopt it
          setCurrencyState(e.newValue);
        } else {
          // A token was stored — re-fetch currency
          fetchCurrency();
        }
      }
    };

    window.addEventListener("storage", handleStorage);

    // Also listen for token changes in the SAME tab (e.g., after login)
    const handleTokenChange = () => {
      fetchCurrency();
    };

    window.addEventListener("authTokenChanged", handleTokenChange);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("authTokenChanged", handleTokenChange);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [fetchCurrency]);

  // Also re-fetch when the pathname changes (client-side navigation after login)
  useEffect(() => {
    // Use popstate for back/forward and a MutationObserver-free approach:
    // Next.js triggers routeChangeComplete which we can't listen to here,
    // but we can poll the pathname change via a lightweight interval that
    // self-clears once the currency is fetched.
    let lastPathname = typeof window !== "undefined" ? window.location.pathname : "";
    const pathCheckInterval = setInterval(() => {
      const currentPathname = window.location.pathname;
      if (currentPathname !== lastPathname) {
        lastPathname = currentPathname;
        fetchCurrency();
      }
    }, 1000);

    // Clear after 10 seconds — by then the currency should be fetched
    const clearTimer = setTimeout(() => {
      clearInterval(pathCheckInterval);
    }, 10000);

    return () => {
      clearInterval(pathCheckInterval);
      clearTimeout(clearTimer);
    };
  }, [fetchCurrency]);

  const setCurrency = (newCurrency: string) => {
    setCurrencyState(newCurrency);
    try { localStorage.setItem(CURRENCY_CACHE_KEY, newCurrency); } catch { }
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
};
