'use client';
import { useEffect, useState, ComponentType } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import { jwtDecode } from 'jwt-decode';

const getStored = (key: string): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(key) || sessionStorage.getItem(key);
};

const isAgentPortalRoute = (pathname?: string | null): boolean => {
  if (!pathname) return false;
  return pathname.startsWith('/agent/') || pathname.startsWith('/staff/');
};

export default function withClinicAuth<P extends Record<string, unknown> = Record<string, unknown>>(WrappedComponent: ComponentType<P>) {
  return function ProtectedClinicPage(props: P) {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
      const checkAuth = async () => {
        try {
          const pathname =
            (typeof window !== 'undefined' ? window.location.pathname : '') ||
            router.asPath ||
            router.pathname;

          // Agent sidebar loads clinic pages under /staff/* and /agent/*.
          // Those sessions only have agentToken (or userToken for doctorStaff),
          // not clinicToken — do not send them to clinic login.
          if (isAgentPortalRoute(pathname)) {
            const agentPortalToken =
              getStored('agentToken') ||
              getStored('userToken') ||
              getStored('doctorToken');

            if (!agentPortalToken) {
              setLoading(false);
              return;
            }

            let decoded: { role?: string } | null = null;
            try {
              decoded = jwtDecode(agentPortalToken);
            } catch {
              decoded = null;
            }

            let verifyEndpoint = '/api/agent/verify-token';
            if (decoded?.role === 'doctor' || decoded?.role === 'doctorStaff') {
              verifyEndpoint = '/api/doctor/verify-token';
            }

            const res = await fetch(verifyEndpoint, {
              headers: {
                Authorization: `Bearer ${agentPortalToken}`,
              },
            });
            const data = await res.json();

            if (res.ok && data.valid) {
              setIsAuthorized(true);
            } else {
              console.error('Agent portal auth error:', data?.message || data);
            }
            setLoading(false);
            return;
          }

          // Read ONLY clinicToken — no cross-role fallback on real clinic routes
          let token = getStored('clinicToken');

          let user = getStored('clinicUser');

          if (!token) {
            router.replace('/clinic/login-clinic');
            setLoading(false);
            return;
          }

          // If clinicUser not found, try to decode token to get user info
          if (!user) {
            try {
              const decoded: any = jwtDecode(token);
              user = JSON.stringify({
                _id: decoded.userId || decoded.id,
                role: decoded.role,
                email: decoded.email,
                name: decoded.name
              });
            } catch (decodeError) {
              console.error('Error decoding token:', decodeError);
              router.replace('/clinic/login-clinic');
              setLoading(false);
              return;
            }
          }

          // Verify token with clinic role check via API
          const res = await fetch('/api/clinics/verify-token', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          const data = await res.json();

          if (!res.ok || !data.valid) {
            // Only clear clinicToken — no cross-role bleed
            try { localStorage.removeItem('clinicToken'); } catch { }
            try { sessionStorage.removeItem('clinicToken'); } catch { }

            const errorMessage = data.message || 'Authentication failed';

            if (data.trialExpired) {
              toast.error(errorMessage);
              setTimeout(() => {
                router.replace('/clinic/login-clinic?trialExpired=true');
              }, 2000);
            } else if (data.message === 'Token expired') {
              alert('Session expired. Please login again.');
              setTimeout(() => {
                router.replace('/clinic/login-clinic');
              }, 4000);
            } else {
              toast.error(errorMessage);
              console.error('Clinic auth error:', errorMessage, data);
              router.replace('/clinic/login-clinic');
            }
            setLoading(false);
            return;
          }

          // Verify user role — only clinic role is allowed on /clinic/* routes
          const userObj = JSON.parse(user);
          const allowedRoles = ['clinic'];
          if (allowedRoles.includes(userObj.role)) {
            setIsAuthorized(true);
          } else {
            toast.error('Access denied: Invalid user role');
            router.replace('/clinic/login-clinic');
          }
        } catch (err) {
          console.error('Auth error:', err);
          const pathname =
            (typeof window !== 'undefined' ? window.location.pathname : '') ||
            router.pathname;
          if (!isAgentPortalRoute(pathname)) {
            setTimeout(() => {
              router.replace('/clinic/login-clinic');
            }, 3000);
          }
        } finally {
          setLoading(false);
        }
      };

      checkAuth();
    }, [router]);

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-[#2D9AA5] rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-700 font-medium">Verifying Clinic...</p>
          </div>
        </div>
      );
    }

    return isAuthorized ? <WrappedComponent {...(props as P)} /> : null;
  };
}
