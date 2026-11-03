import { Html, Head, Main, NextScript } from 'next/document';
import { DOCTOR_APP_PAGE_SEGMENTS } from '../config/siteThemeRoutes';

export default function Document() {
  return (
    <Html>
      <Head>
        {/* Favicon link */}
        <link rel="icon" type="image/png" href="/favicon.png" />
        {/* Optional: SVG or PNG alternative */}
        {/* <link rel="icon" type="image/png" href="/favicon.png" /> */}
        {/* Google Fonts - Script Font & Display Font */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Dancing+Script:wght@400;500;600;700&family=Playfair+Display:wght@400;500;600;700;800;900&family=Montserrat:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        
        {/* Google Tag Manager */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','GTM-WVK28WH4');`,
          }}
        />
        {/* End Google Tag Manager */}
      </Head>
      <body>
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-WVK28WH4"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          ></iframe>
        </noscript>
        {/* End Google Tag Manager (noscript) */}
        
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('clinicTheme') || 'system';
                  var root = document.documentElement;
                  var path = window.location.pathname;
                  var publicClinicRoutes = [
                    '/findclinic',
                    '/login-clinic',
                    '/register-clinic',
                    '/clinic/forgot-password',
                    '/clinic/reset-password',
                    '/clinic/review-form',
                    '/clinic/enquiry-form',
                    '/clinic/appointment-landing',
                    '/clinic/appointment-booking',
                    '/clinic/job-applicants'
                  ];
                  var isPublicClinicRoute = publicClinicRoutes.some(function(route) {
                    return path === route || path.indexOf(route + '/') === 0;
                  });
                  var isDashboardRoute = (path === '/clinic' || path.indexOf('/clinic/') === 0 || path === '/staff' || path.indexOf('/staff/') === 0) && !isPublicClinicRoute;
                  var siteTheme = localStorage.getItem('siteTheme') || 'light';
                  var appScoped = ['/clinic', '/doctor', '/staff', '/agent', '/admin'];
                  var isAppScopedRoute = appScoped.some(function(prefix) {
                    return path === prefix || path.indexOf(prefix + '/') === 0;
                  });
                  // Public doctor profile (/doctor/<slug>) uses the site header, so it follows the site theme
                  var doctorAppPages = ${JSON.stringify(DOCTOR_APP_PAGE_SEGMENTS)};
                  var segments = path.split('/').filter(Boolean);
                  var isPublicDoctorProfile = segments.length === 2 && segments[0] === 'doctor' && doctorAppPages.indexOf(segments[1]) === -1;
                  if (isPublicDoctorProfile) isAppScopedRoute = false;
                  var isSiteThemeRoute = !isDashboardRoute && !isAppScopedRoute;
                  var activeTheme = isDashboardRoute ? theme : (isSiteThemeRoute ? siteTheme : 'light');
                  if (activeTheme === 'dark' || (activeTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    root.classList.add('dark');
                    root.style.colorScheme = 'dark';
                  } else {
                    root.classList.remove('dark');
                    root.style.colorScheme = 'light';
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
