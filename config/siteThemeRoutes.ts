/**
 * Public pages that live under an app-scoped URL prefix (/clinic, /doctor,
 * /staff, /agent, /admin) but are rendered with the public site Header/Layout.
 * Those pages follow the site theme chosen in the header instead of the theme
 * of the app area they sit under.
 *
 * Used by:
 *  - context/ClinicThemeContext.tsx (client-side theme controller)
 *  - pages/_document.tsx (pre-paint inline script, avoids a theme flash)
 */

// First-level /doctor/* segments that belong to the doctor app (dashboard,
// auth, management, lead/marketing sub-sections). Everything else directly
// under /doctor/ is the public doctor profile page (/doctor/[id]).
export const DOCTOR_APP_PAGE_SEGMENTS = [
  'assigned-leads',
  'BlogForm',
  'cancelled-claims',
  'chat',
  'create-agent',
  'create-job',
  'create-offer',
  'doctor-dashboard',
  'forgot-password',
  'getAuthorCommentsAndLikes',
  'getReview',
  'job-applicants',
  'lead',
  'manageDoctor',
  'marketing',
  'my-jobs',
  'pending-claims',
  'prescription-requests',
  'published-blogs',
  'reset-password',
  'review-form',
  'seed-navigation',
  'staff',
];

const doctorAppPageSet = new Set(DOCTOR_APP_PAGE_SEGMENTS);

/**
 * True for the public doctor profile page, false for doctor app pages.
 * Works both with a real URL ('/doctor/dr-mohan-simple-noida-sector-2') and
 * with a Next.js route pattern ('/doctor/[id]').
 */
export const isPublicDoctorProfilePath = (pathname: string = ''): boolean => {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length !== 2 || segments[0] !== 'doctor') return false;
  return !doctorAppPageSet.has(segments[1]);
};
