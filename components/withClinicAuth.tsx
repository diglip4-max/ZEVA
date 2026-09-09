'use client';
import { useEffect, useState, ComponentType } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import { jwtDecode } from 'jwt-decode';

// Helper: decode role from clinicToken only
// const getClinicTokenRole = (): string | null => {
//   if (typeof window === 'undefined') return null;
//   try {
//     const token = localStorage.getItem('clinicToken') || sessionStorage.getItem('clinicToken');
//     if (!token) return null;
//     const decoded: any = jwtDecode(token);
//     return decoded?.role || null;
//   } catch (err) {
//     console.warn('Unable to decode clinicToken:', err);
//     return null;
//   }
// };

export default function withClinicAuth<P extends Record<string, unknown> = Record<string, unknown>>(WrappedComponent: ComponentType<P>) {
  return function ProtectedClinicPage(props: P) {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
      const checkAuth = async () => {
        try {
          // Read ONLY clinicToken — no cross-role fallback
          let token = typeof window !== 'undefined'
            ? (localStorage.getItem('clinicToken') || sessionStorage.getItem('clinicToken'))
            : null;

          let user = typeof window !== 'undefined'
            ? (localStorage.getItem('clinicUser') || sessionStorage.getItem('clinicUser'))
            : null;

          if (!token) {
            // No clinicToken — redirect to clinic login
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

          // Verify user role — only clinic role is allowed
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
          // Network error - don't clear tokens, just redirect
          setTimeout(() => {
            router.replace('/clinic/login-clinic');
          }, 3000);
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
