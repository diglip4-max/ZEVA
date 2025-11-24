'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { toast, Toaster } from 'react-hot-toast';

export default function withDoctorAuth(WrappedComponent) {
  return function WithDoctorAuth(props) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
      const clearStorage = () => {
        const keys = ['userToken'];
        keys.forEach((k) => {
          try { localStorage.removeItem(k); } catch {}
          try { sessionStorage.removeItem(k); } catch {}
        });
      };

      const checkAuth = async () => {
        const token = typeof window !== 'undefined'
          ? (localStorage.getItem('userToken') || sessionStorage.getItem('staffToken') || localStorage.getItem('staffToken') || sessionStorage.getItem('token'))
          : null;

        if (!token) {
          toast.error('Please login to continue');
          clearStorage();
          setTimeout(() => router.replace('/staff'), 4000);
          return;
        }

        try {
          const response = await fetch('/api/doctor/verify-token', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          const data = await response.json();

          if (response.ok && data.valid) {
            setIsAuthenticated(true);
          } else {
            if (data.message === 'Token expired') {
              toast.error('Session expired. Logging out in 4 seconds…');
            } else {
              toast.error('Authentication failed. Logging out in 4 seconds…');
            }
            clearStorage();
            setTimeout(() => router.replace('/staff'), 4000);
          }
        } catch (error) {
          console.error('Doctor token verification failed:', error);
          toast.error('Something went wrong. Logging out in 4 seconds…');
          clearStorage();
          setTimeout(() => router.replace('/staff'), 4000);
        } finally {
          setIsLoading(false);
        }
      };

      checkAuth();
    }, [router]);

    if (isLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-[#2D9AA5] rounded-full animate-spin mx-auto mb-4"></div>
            <div className="text-lg text-gray-700 font-medium">
              Verifying staff authentication...
            </div>
          </div>
        </div>
      );
    }

    return (
      <>
        <Toaster />
        {isAuthenticated ? <WrappedComponent {...props} /> : null}
      </>
    );
  };
}
