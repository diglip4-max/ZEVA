import type { AppProps } from 'next/app';
import { useEffect, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { DefaultSeo } from 'next-seo';
import Layout from '../components/Layout';
import AgentLayout from '../components/AgentLayout';
import SEO from '../next-seo.config';
import '../styles/globals.css';
import { SearchProvider } from '../context/SearchContext';
import { AuthProvider } from '../context/AuthContext';
import { LoadScript } from '@react-google-maps/api';
import Loader from '../components/Loader';
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export type NextPageWithLayout = AppProps['Component'] & {
  getLayout?: (page: ReactElement) => ReactNode;
};

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
};

function MyApp({ Component, pageProps }: AppPropsWithLayout) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // ✅ Exclude loader for admin, clinic, doctor, and agent layouts
  const isExcludedRoute =
    router.pathname.startsWith('/admin') ||
    router.pathname.startsWith('/clinic') ||
    router.pathname.startsWith('/doctor') ||
    router.pathname.startsWith('/agent');

  // For agent routes, ALWAYS use AgentLayout to ensure consistent sidebar
  // This overrides any getLayout defined on the component (like AdminLayout)
  let getLayout = Component.getLayout || ((page: ReactNode) => <Layout>{page}</Layout>);
  
  // Force AgentLayout for all /agent/* routes to ensure sidebar consistency
  if (router.pathname.startsWith('/agent/')) {
    getLayout = (page: ReactNode) => <AgentLayout>{page}</AgentLayout>;
  }

  useEffect(() => {

    const btn = document.querySelector('[data-nextjs-feedback-button]');
    if (btn) btn.remove();
    
    let fallbackTimeout: NodeJS.Timeout | null = null;

    if (!isExcludedRoute) {
      const handleStart = () => {
        console.log('[Loader] routeChangeStart - showing loader');
        setLoading(true);
        // Fallback: hide loader after 5 seconds if not already hidden
        if (fallbackTimeout) clearTimeout(fallbackTimeout);
        fallbackTimeout = setTimeout(() => {
          console.log('[Loader] Fallback timeout reached - hiding loader');
          setLoading(false);
        }, 5000);
      };
      const handleComplete = () => {
        console.log('[Loader] routeChangeComplete/Error - hiding loader');
        setLoading(false);
        if (fallbackTimeout) clearTimeout(fallbackTimeout);
      };

      router.events.on('routeChangeStart', handleStart);
      router.events.on('routeChangeComplete', handleComplete);
      router.events.on('routeChangeError', handleComplete);

      return () => {
        router.events.off('routeChangeStart', handleStart);
        router.events.off('routeChangeComplete', handleComplete);
        router.events.off('routeChangeError', handleComplete);
        if (fallbackTimeout) clearTimeout(fallbackTimeout);
      };
    }
  }, [router, isExcludedRoute]);

  // NEW: Always reset loader on any route change complete or error (fixes stuck loader)
  useEffect(() => {
    const alwaysResetLoader = () => {
      setLoading(false);
    };
    router.events.on('routeChangeComplete', alwaysResetLoader);
    router.events.on('routeChangeError', alwaysResetLoader);
    return () => {
      router.events.off('routeChangeComplete', alwaysResetLoader);
      router.events.off('routeChangeError', alwaysResetLoader);
    };
  }, [router]);

  return (
    <>
      {/* ✅ Show loader only for public (non-excluded) routes */}
      {!isExcludedRoute && loading && <Loader />}

      <AuthProvider>
        <SearchProvider>
          <Head>
            <meta name="viewport" content="initial-scale=1.0, width=device-width" />
            <link rel="icon" href="/favicon.ico" />
          </Head>
          <DefaultSeo {...SEO} />
          <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY || ''}>
            {getLayout(<Component {...pageProps} />)}
          </LoadScript>
        </SearchProvider>
      </AuthProvider>
    </>
  );
}

export default MyApp;
