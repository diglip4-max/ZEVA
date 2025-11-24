'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { ComponentType } from 'react';
import { toast, Toaster } from 'react-hot-toast'; // 👈 import toast and Toaster

export default function withAgentAuth<P extends object>(
  WrappedComponent: ComponentType<P>
) {
  return function WithAgentAuth(props: P) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
      const clearStorage = () => {
        // Remove stored auth tokens
        const keys = ['token', 'userToken', 'agentToken'];
        keys.forEach((k) => {
          try { localStorage.removeItem(k); } catch {}
          try { sessionStorage.removeItem(k); } catch {}
        });
      };

      const checkAuth = async () => {
        const token = typeof window !== 'undefined'
          ? (localStorage.getItem('agentToken') || sessionStorage.getItem('agentToken'))
          : null;

        if (!token) {
          toast.error('Please login as an agent to continue');
          clearStorage();
          setIsLoading(false);
          router.replace('/staff');
          return;
        }

        try {
          const response = await fetch('/api/agent/verify-token', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          const data = await response.json();

          if (response.ok && data.valid) {
            setIsAuthenticated(true);
          } else {
            const message = data.message === 'Token expired'
              ? 'Session expired. Please login again.'
              : data.message || 'Authentication failed. Please login again.';
            toast.error(message);
            clearStorage();
            router.replace('/staff');
          }
        } catch (error) {
          console.error('Agent token verification failed:', error);
          toast.error('Something went wrong. Please login again.');
          clearStorage();
          router.replace('/staff');
        } finally {
          setIsLoading(false);
        }
      };

      checkAuth();
    }, [router]);

    if (isLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-lg">Verifying authentication...</div>
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