'use client';
import { useEffect, useState, ComponentType } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import { jwtDecode } from 'jwt-decode';

export default function withClinicAuth<P extends Record<string, unknown> = Record<string, unknown>>(WrappedComponent: ComponentType<P>) {
  return function ProtectedClinicPage(props: P) {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
      const checkAuth = async () => {
        try {
          // Check for multiple token types in priority order
          let token = typeof window !== 'undefined' 
            ? (localStorage.getItem('clinicToken') || 
               sessionStorage.getItem('clinicToken') ||
               localStorage.getItem('agentToken') ||
               sessionStorage.getItem('agentToken') ||
               localStorage.getItem('userToken') ||
               sessionStorage.getItem('userToken'))
            : null;
          
          let user = typeof window !== 'undefined' 
            ? (localStorage.getItem('clinicUser') || sessionStorage.getItem('clinicUser'))
            : null;

          if (!token) {
            toast.error('Please login to continue');
            clearStorage();
            
            // Check user role to determine redirect destination
            let role = null;
            // Check all possible token storage locations
            for (const key of ['clinicToken', 'agentToken', 'userToken']) {
              const token = localStorage.getItem(key) || sessionStorage.getItem(key);
              if (token) {
                try {
                  // Decode JWT token to get role
                  const base64Url = token.split('.')[1];
                  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                  const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                  }).join(''));
                  const decoded = JSON.parse(jsonPayload);
                  role = decoded?.role || null;
                  break;
                } catch (err) {
                  console.warn('Unable to decode token:', err);
                }
              }
            }
            
            // Redirect based on role
            if (role === 'staff' || role === 'doctorStaff') {
              router.replace('/staff');
            } else {
              router.replace('/clinic/login-clinic');
            }
            setLoading(false);
            return;
          }

          // If clinicUser not found, try to decode token to get user info
          if (!user) {
            try {
              const decoded: any = jwtDecode(token);
              // Create a user object from decoded token
              user = JSON.stringify({
                _id: decoded.userId || decoded.id,
                role: decoded.role,
                email: decoded.email,
                name: decoded.name
              });
            } catch (decodeError) {
              console.error('Error decoding token:', decodeError);
              toast.error('User data not found. Please login again.');
              clearStorage();
              
              // Check user role to determine redirect destination
              let role = null;
              // Check all possible token storage locations
              for (const key of ['clinicToken', 'agentToken', 'userToken']) {
                const token = localStorage.getItem(key) || sessionStorage.getItem(key);
                if (token) {
                  try {
                    // Decode JWT token to get role
                    const base64Url = token.split('.')[1];
                    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                    }).join(''));
                    const decoded = JSON.parse(jsonPayload);
                    role = decoded?.role || null;
                    break;
                  } catch (err) {
                    console.warn('Unable to decode token:', err);
                  }
                }
              }
              
              // Redirect based on role
              if (role === 'staff' || role === 'doctorStaff') {
                router.replace('/staff');
              } else {
                router.replace('/clinic/login-clinic');
              }
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
            clearStorage();
            const errorMessage = data.message || 'Authentication failed';
            
            if (data.message === 'Token expired') {
              alert('Session expired. Please login again.');
              setTimeout(() => {
                router.replace('/clinic/login-clinic');
              }, 4000);
            } else {
              // Show the actual error message from the API
              toast.error(errorMessage);
              console.error('Clinic auth error:', errorMessage, data);
              router.replace('/clinic/login-clinic');
            }
            setLoading(false);
            return;
          }

          // Verify user role - allow clinic, agent, doctor, doctorStaff, and staff roles
          const userObj = JSON.parse(user);
          const allowedRoles = ['clinic', 'agent', 'doctor', 'doctorStaff', 'staff'];
          if (allowedRoles.includes(userObj.role)) {
            setIsAuthorized(true);
          } else {
            toast.error('Access denied: Invalid user role');
            clearStorage();
            
            // Check user role to determine redirect destination
            let role = null;
            // Check all possible token storage locations
            for (const key of ['clinicToken', 'agentToken', 'userToken']) {
              const token = localStorage.getItem(key) || sessionStorage.getItem(key);
              if (token) {
                try {
                  // Decode JWT token to get role
                  const base64Url = token.split('.')[1];
                  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                  const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                  }).join(''));
                  const decoded = JSON.parse(jsonPayload);
                  role = decoded?.role || null;
                  break;
                } catch (err) {
                  console.warn('Unable to decode token:', err);
                }
              }
            }
            
            // Redirect based on role
            if (role === 'staff' || role === 'doctorStaff') {
              router.replace('/staff');
            } else {
              router.replace('/clinic/login-clinic');
            }
          }
        } catch (err) {
          console.error('Auth error:', err);
          toast.error('Session expired. Please login again.');
          clearStorage();
          
          // Check user role to determine redirect destination
          let role = null;
          // Check all possible token storage locations
          for (const key of ['clinicToken', 'agentToken', 'userToken']) {
            const token = localStorage.getItem(key) || sessionStorage.getItem(key);
            if (token) {
              try {
                // Decode JWT token to get role
                const base64Url = token.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                  return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
                const decoded = JSON.parse(jsonPayload);
                role = decoded?.role || null;
                break;
              } catch (err) {
                console.warn('Unable to decode token:', err);
              }
            }
          }
          
          setTimeout(() => {
            // Redirect based on role
            if (role === 'staff' || role === 'doctorStaff') {
              router.replace('/staff');
            } else {
              router.replace('/clinic/login-clinic');
            }
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
