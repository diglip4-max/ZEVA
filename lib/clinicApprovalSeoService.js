/**
 * Clinic Approval SEO Service
 *
 * Shared, entity-flow logic used whenever a clinic becomes "live":
 *   1. Generate + lock the SEO slug (name + city) via the central slug service.
 *   2. Run the full SEO pipeline (indexing, robots, meta, canonical, sitemap, ping).
 *   3. Build user-friendly SEO messages for the caller's response.
 *
 * Both the admin approval endpoint (/api/admin/update-approve) and the clinic
 * self-registration endpoint (/api/clinics/register) call this so the slug +
 * SEO behaviour is identical regardless of how the clinic got approved.
 *
 * Keeping this in one place means: clinics that are auto-approved (isApproved
 * defaults to true) still get their city-based slug + SEO treatment without
 * ever passing through the AdminClinicApproval queue.
 */

import Clinic from '../models/Clinic';
import { generateAndLockSlug, refreshSlugForEntity, getEntityRoute } from './slugService';
import { runSEOPipeline } from './seo/SEOOrchestrator';

/**
 * Build user-friendly SEO messages from the pipeline result.
 * @param {Object} seoResult - Result returned by runSEOPipeline
 * @returns {Array<{type: string, message: string}>}
 */
function buildSeoMessages(seoResult) {
  const messages = [];

  // On overall failure there are no per-step messages to surface (matches admin flow).
  if (!seoResult || !seoResult.success) {
    messages.push({
      type: 'warning',
      message: '⚠️ SEO setup completed with some warnings. Please review your clinic profile.',
    });
    return messages;
  }

  if (seoResult.indexing) {
    if (!seoResult.indexing.shouldIndex) {
      messages.push({
        type: 'info',
        message: `🚧 Your clinic page is saved as draft. ${seoResult.indexing.reason}. Complete your profile to appear on Google search results.`,
      });
    } else {
      messages.push({
        type: 'success',
        message: '✅ Your clinic page is ready for Google search!',
      });
    }
  }

  if (seoResult.robots) {
    const robotsMsg = seoResult.robots.noindex
      ? 'Search engines will wait until your profile is complete.'
      : 'Search engines can now index your clinic page.';
    messages.push({ type: 'info', message: robotsMsg });
  }

  if (seoResult.meta) {
    messages.push({
      type: 'success',
      message: '✨ We optimized your clinic page for Google search to improve visibility.',
    });
  }

  if (seoResult.headings) {
    messages.push({
      type: 'success',
      message: '🧾 Page headings are optimized to avoid duplication on search engines.',
    });
  }

  if (seoResult.canonical) {
    messages.push({
      type: 'success',
      message: '🔗 Your clinic page has a single official link to avoid confusion on Google.',
    });
  }

  if (seoResult.duplicateCheck) {
    if (seoResult.duplicateCheck.isDuplicate) {
      messages.push({
        type: 'warning',
        message: `⚠️ Similar clinic found: ${seoResult.duplicateCheck.reason}`,
      });
    } else {
      messages.push({
        type: 'success',
        message: '✅ Your clinic is recognized as a separate and unique business.',
      });
    }
  }

  if (seoResult.sitemapUpdated) {
    messages.push({
      type: 'success',
      message: '📡 Your clinic page has been submitted for discovery on search engines.',
    });
  }

  if (seoResult.pinged) {
    messages.push({
      type: 'success',
      message: '🚀 Search engines have been notified. Your page will start appearing soon.',
    });
  }

  return messages;
}

/**
 * Generate + lock the clinic slug and run the SEO pipeline.
 *
 * Safe to call repeatedly: if the slug is already locked, it returns the
 * existing clinic without regenerating (protects SEO rankings).
 *
 * @param {string} clinicId - The clinic's Mongo _id (string or ObjectId)
 * @returns {Promise<{
 *   finalClinic: any,
 *   slugGenerated: boolean,
 *   seoMessages: Array<{type: string, message: string}>,
 *   seoResult: any,
 * }>}
 */
export async function approveClinicSeo(clinicId) {
  // Always re-read from DB so we evaluate the latest isApproved/slugLocked state.
  const clinic = await Clinic.findById(clinicId);
  if (!clinic) {
    throw new Error('Clinic not found');
  }

  // Default result shape (returned unchanged when slug is already locked).
  let finalClinic = clinic;
  let slugGenerated = false;
  let seoMessages = [];
  let seoResult = null;

  // Slug + SEO only make sense once the clinic is approved and not yet locked.
  if (clinic.slugLocked || !clinic.isApproved) {
    return { finalClinic, slugGenerated, seoMessages, seoResult };
  }

  try {
    // Step 1: Generate + lock the name+city slug via the central slug service.
    const updatedClinic = await generateAndLockSlug('clinic', clinicId.toString());
    slugGenerated = !!(updatedClinic && updatedClinic.slug && updatedClinic.slugLocked);

    // Refresh to read persisted slug.
    finalClinic = await Clinic.findById(clinicId);

    if (slugGenerated) {
      // Step 2: Run the SEO pipeline (non-fatal on error).
      try {
        seoResult = await runSEOPipeline('clinic', clinicId.toString(), finalClinic);
        // Step 3: Build friendly messages for the response.
        seoMessages = buildSeoMessages(seoResult);
      } catch (seoError) {
        seoMessages.push({
          type: 'error',
          message: '❌ SEO setup encountered an error. Your clinic is approved but SEO features may be limited.',
        });
      }
    }
  } catch (slugError) {
    // Slug generation is non-fatal for approval; the caller logs if needed.
    console.error('⚠️ Clinic slug/SEO generation failed (non-fatal):', slugError.message);
  }

  return { finalClinic, slugGenerated, seoMessages, seoResult };
}

/**
 * Derive the city from a stored clinic address.
 * The whole slug pipeline treats the FIRST comma segment of the address as the
 * city, so this is the single canonical reader of that convention.
 * @param {string} address
 * @returns {string}
 */
export function getCityFromAddress(address) {
  if (!address || typeof address !== 'string') return '';
  return address.split(',')[0].trim();
}

/**
 * Normalise an address into the project's "City, <details>" storage convention
 * so the generated URL always carries the right city.
 * @param {string} address - Raw address typed by the clinic
 * @param {string} city - City resolved from geocoding (optional)
 * @returns {string}
 */
export function buildCityFirstAddress(address, city) {
  const raw = (address || '').trim();
  const resolvedCity = (city || '').trim();
  if (!resolvedCity) return raw;
  if (raw.toLowerCase().startsWith(`${resolvedCity.toLowerCase()},`)) return raw;
  if (!raw) return resolvedCity;
  return `${resolvedCity}, ${raw}`;
}

/**
 * Re-point the clinic's public URL at its CURRENT location.
 *
 * Used when a clinic edits its location from the clinic profile
 * (/clinic/myallClinic). The registration/approval slug rule is
 * `name + city`, so a location change must move the city segment of the URL too.
 * The SEO lock itself is preserved, the retired slug is kept for redirects, and
 * the sitemap/ping pipeline is re-run so search engines follow the new URL.
 *
 * @param {string|ObjectId} clinicId
 * @returns {Promise<{
 *   urlUpdated: boolean,
 *   slug: string|null,
 *   previousSlug: string|null,
 *   url: string|null,
 *   seoResult: any,
 * }>}
 */
export async function syncClinicUrlWithLocation(clinicId) {
  const clinic = await Clinic.findById(clinicId);
  if (!clinic) {
    throw new Error('Clinic not found');
  }

  const noop = {
    urlUpdated: false,
    slug: clinic.slug || null,
    previousSlug: null,
    url: clinic.slug
      ? `${process.env.NEXT_PUBLIC_BASE_URL || 'https://zeva360.com'}${getEntityRoute('clinic', clinic.slug)}`
      : null,
    seoResult: null,
  };

  // Clinics that have not been through approval yet must not get a slug here -
  // that stays owned by approveClinicSeo.
  if (!clinic.slugLocked || !clinic.isApproved) {
    return noop;
  }

  try {
    const result = await refreshSlugForEntity('clinic', clinicId.toString());

    if (!result.updated) {
      // Location changed but not the derived city (or nothing changed at all):
      // the existing URL stays exactly as it is, which is what SEO needs.
      return noop;
    }

    const finalClinic = await Clinic.findById(clinicId);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://zeva360.com';

    // Re-run the SEO pipeline so the sitemap + canonical reflect the new URL.
    let seoResult = null;
    try {
      seoResult = await runSEOPipeline('clinic', clinicId.toString(), finalClinic);
    } catch (seoError) {
      // SEO refresh is non-fatal - the slug update already succeeded.
      console.error('⚠️ SEO pipeline refresh after location change (non-fatal):', seoError.message);
    }

    return {
      urlUpdated: true,
      slug: result.slug,
      previousSlug: result.previousSlug,
      url: `${baseUrl}${getEntityRoute('clinic', result.slug)}`,
      seoResult,
    };
  } catch (slugError) {
    console.error('⚠️ Clinic URL sync after location change failed (non-fatal):', slugError.message);
    return noop;
  }
}

export default approveClinicSeo;
