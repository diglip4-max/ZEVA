'use client';
import { useEffect, useState, ComponentType } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';

export default function withClinicAuth<P extends Record<string, unknown> = Record<string, unknown>>(WrappedComponent: ComponentType<P>) {
  return function ProtectedClinicPage(props: P) {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
      const checkAuth = async () => {
        try {
          const token = typeof window !== 'undefined' 
            ? (localStorage.getItem('clinicToken') || sessionStorage.getItem('clinicToken'))
            : null;
          const user = typeof window !== 'undefined' 
            ? (localStorage.getItem('clinicUser') || sessionStorage.getItem('clinicUser'))
            : null;

          if (!token) {
            toast.error('Please login to continue');
            clearStorage();
            router.replace('/clinic/login-clinic');
            setLoading(false);
            return;
          }

          if (!user) {
            toast.error('User data not found. Please login again.');
            clearStorage();
            router.replace('/clinic/login-clinic');
            setLoading(false);
            return;
          }

          // Verify token with clinic role check via API
          const res = await fetch('/api/clinics/verify-token', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          const data = await res.json();

          if (!res.ok || !data.valid) {
            clearStorage();
            if (data.message === 'Token expired') {
              alert('Session expired. Please login again.');
              setTimeout(() => {
                router.replace('/clinic/login-clinic');
              }, 4000);
            } else {
              toast.error('Authentication failed.');
              router.replace('/clinic/login-clinic');
            }
            setLoading(false);
            return;
          }

          // Verify user role is clinic
          const userObj = JSON.parse(user);
          if (userObj.role === 'clinic') {
            setIsAuthorized(true);
          } else {
            toast.error('Access denied: Invalid user role');
            clearStorage();
            router.replace('/clinic/login-clinic');
          }
        } catch (err) {
          console.error('Auth error:', err);
          toast.error('Session expired. Please login again.');
          clearStorage();
          setTimeout(() => {
            router.replace('/clinic/login-clinic');
          }, 3000);
        } finally {
          setLoading(false);
        }
      };

      const clearStorage = () => {
        localStorage.removeItem('clinicToken');
        localStorage.removeItem('clinicUser');
        localStorage.removeItem('clinicEmail');
        localStorage.removeItem('clinicName');
        sessionStorage.removeItem('clinicToken');
        sessionStorage.removeItem('clinicUser');
        sessionStorage.removeItem('clinicEmail');
        sessionStorage.removeItem('clinicName');
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
