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
    } catch (error: any) {
      // Auth 401s are expected when tokens are not yet valid / session ended.
      // They must NOT surface to the UI — only to the Network tab.
      const status = error?.response?.status;
      const code = error?.code;
      const isExpectedAuthError =
        status === 401 ||
        status === 403 ||
        code === "ERR_NETWORK" ||
        code === "ECONNABORTED";

      if (!isExpectedAuthError && typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
        // Only non-auth anomalies get a lightweight, message-only log (no error object)
        // so React error overlays never render the exception stack.
        console.debug("[CurrencyProvider] fetch anomaly:", error?.message || String(error));
      }
      // Keep current value if anything fails — never rethrow
    }
    return false;
  }, []);

  useEffect(() => {
    // Attempt to fetch currency immediately on mount
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;
    const maxRetries = 5;

    const attemptFetch = async () => {
      try {
        const success = await fetchCurrency();
        // If auth headers weren't ready yet (just after login redirect), retry after a short delay
        if (!success && retryCount < maxRetries) {
          retryCount++;
          retryTimer = setTimeout(async () => {
            try { await attemptFetch(); } catch { /* swallow */ }
          }, 1500);
        }
      } catch {
        // Swallow — never let a promise rejection escape to UI error surfaces
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
          try { fetchCurrency(); } catch { /* swallow */ }
        }
      }
    };

    window.addEventListener("storage", handleStorage);

    // Also listen for token changes in the SAME tab (e.g., after login)
    const handleTokenChange = () => {
      try { fetchCurrency(); } catch { /* swallow */ }
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
      try {
        const currentPathname = window.location.pathname;
        if (currentPathname !== lastPathname) {
          lastPathname = currentPathname;
          fetchCurrency();
        }
      } catch { /* swallow */ }
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
