/**
 * pages/api/admin/backfill-clinic-urls.js
 *
 * Admin repair tool for clinic public URLs that do not follow the app's URL rules.
 *
 * WHY THIS EXISTS
 * 1) mode=clean (DEFAULT) - some legacy clinic documents hold a pasted URL in the
 *    slug field ("zeva.com/sarthak"). /clinics/[slug] is a single path segment, so
 *    those links came out with the domain twice:
 *        https://zeva360.com/clinics/zeva.com/sarthak   (broken + duplicated host)
 *    instead of
 *        https://zeva360.com/clinics/sarthak
 *    This mode ONLY strips the URL wrapper. The slug text itself is preserved, so
 *    no clinic gets renamed beyond the junk that was wrapping it. Future writes
 *    cannot reintroduce it: slugService.validateSlug() rejects any slug that is not
 *    lowercase alphanumeric-with-hyphens, so a value containing "/" can never be
 *    locked through the slug service.
 *
 * 2) mode=address | mode=geocode - clinics created before the current rule
 *    ("slugify(name) + '-' + slugify(city)") can be moved onto the new SEO format.
 *    The shared approval/sync services do the writing, so the URL rule lives in
 *    exactly one place (lib/clinicApprovalSeoService.js).
 *
 * SAFETY
 *   - DRY RUN by default: nothing is written unless POST { apply: true }.
 *   - Admin only, and GET can never write (it reads params from the query string).
 *   - A retired slug is pushed into Clinic.previousSlugs so previously shared /
 *     indexed links keep working through the 301 in pages/api/clinics/by-slug/[slug].js.
 *   - Idempotent: whatever already matches its rule is counted and left alone, so
 *     the run can be repeated safely.
 *
 * USAGE
 *   Local browser (development only - the token may travel in the query string):
 *     http://localhost:3000/api/admin/backfill-clinic-urls?token=<adminToken>
 *   PowerShell / curl (works in production):
 *     $h = @{ Authorization = "Bearer <adminToken>"; "Content-Type" = "application/json" }
 *     Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/admin/backfill-clinic-urls" `
 *       -Headers $h -Body '{}'                                   # dry run, clean mode
 *     Invoke-RestMethod ... -Body '{"apply":true}'              # write the cleanup
 *     Invoke-RestMethod ... -Body '{"mode":"geocode"}'          # preview name-city SEO pass
 *
 * OPTIONS (body for POST, query string for GET)
 *   apply: true          write changes (default false = dry run; GET never writes)
 *   mode: "clean"        DEFAULT - strip a pasted URL out of stored slugs
 *   mode: "address"      city = address.split(",")[0], slug = name-city
 *   mode: "geocode"      city = Google geocoded locality, address stored as
 *                        "City, <original>" so the URL rule keeps working
 *   clinicId: "<id>"     limit the run to a single clinic
 *   limit: 500           max clinics per run (default 500, max 2000)
 *   skipSeo: true        clean mode only: do not re-run the SEO pipeline per clinic
 *                        (the address/geocode modes reuse the shared services, which
 *                        always refresh SEO as part of moving a URL)
 */
import axios from "axios";
import dbConnect from "../../../lib/database";
import Clinic from "../../../models/Clinic";
import { getUserFromReq } from "../lead-ms/auth";
import {
  slugify,
  generateUniqueSlug,
  extractSlugFromUrl,
} from "../../../lib/utils";
import {
  getCityFromAddress,
  buildCityFirstAddress,
  approveClinicSeo,
  syncClinicUrlWithLocation,
} from "../../../lib/clinicApprovalSeoService";
import { runSEOPipeline } from "../../../lib/seo/SEOOrchestrator";

// Google's free geocoding quota is generous but not unlimited: a full clinic list
// must not hammer the endpoint in a tight loop.
const GEOCODE_PAUSE_MS = 150;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const dedupe = (list) => list.filter((s, i, arr) => s && arr.indexOf(s) === i);

/**
 * Clean stored slug (strip any pasted URL) that is still free of collisions.
 * The unique index on Clinic.slug is sparse but not limited to locked slugs, so
 * every existing document has to be considered, not just approved ones.
 */
async function ensureUniqueSlug(baseSlug, clinic) {
  const checkExists = async (candidate) => {
    const clash = await Clinic.findOne({
      slug: candidate,
      _id: { $ne: clinic._id },
    }).lean();
    return !!clash;
  };
  return generateUniqueSlug(baseSlug, checkExists);
}

/**
 * Ask Google for the locality of a free-text address.
 * Mirrors pages/api/clinics/geocode.js so both paths resolve cities identically.
 */
async function resolveCityViaGeocode(address) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) {
    throw new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set");
  }

  const response = await axios.get("https://maps.googleapis.com/maps/api/geocode/json", {
    params: { address, key, region: "in" },
    timeout: 15000,
  });

  if (response.data?.status !== "OK" || !response.data?.results?.length) {
    return "";
  }

  const components = response.data.results[0].address_components || [];
  const pick = (type) =>
    components.find((c) => (c.types || []).includes(type))?.long_name || "";

  return (
    pick("locality") ||
    pick("administrative_area_level_2") ||
    pick("postal_town") ||
    pick("administrative_area_level_1")
  );
}

/** Does this slug already contain the city segment? (handles "-1" collision suffixes) */
function slugCarriesCity(slug, citySlug) {
  if (!slug || !citySlug) return false;
  return (
    slug === citySlug ||
    slug.endsWith(`-${citySlug}`) ||
    slug.includes(`-${citySlug}-`)
  );
}

/**
 * Resolve the caller through the app's normal admin auth.
 *
 * In development only, the token may also arrive as ?token=... so a dry run can be
 * pasted straight into a browser on localhost. Production still requires the
 * Authorization header, and GET requests can never write anything.
 */
async function resolveAdmin(req) {
  const devToken = process.env.NODE_ENV !== "production" ? req.query?.token : null;

  if (devToken && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${devToken}`;
  }

  return getUserFromReq(req);
}

export default async function handler(req, res) {
  const isGet = req.method === "GET";
  if (req.method !== "POST" && !isGet) {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  await dbConnect();

  // Bulk URL surgery is admin-only on purpose: agents must not be able to move
  // production clinic links.
  const me = await resolveAdmin(req);
  if (!me) {
    return res.status(401).json({
      success: false,
      message:
        "Unauthorized: Missing or invalid token. An admin token must be sent as " +
        "'Authorization: Bearer <adminToken>' (on localhost ?token=<adminToken> also works in development).",
      usage: {
        dryRun: "GET/POST with no body (writes nothing)",
        apply: 'POST only, body {"apply":true} (GET can never write)',
        modes: ["clean", "address", "geocode"],
        options: ["clinicId", "limit", "skipSeo"],
      },
    });
  }
  if (me.role !== "admin") {
    return res
      .status(403)
      .json({ success: false, message: "Only an admin can backfill clinic URLs" });
  }

  // GET is a convenience for localhost dry runs: it reads params from the query
  // string, and it is structurally incapable of writing.
  const body = isGet ? req.query || {} : req.body || {};
  const apply = !isGet && (body.apply === true || body.apply === "true" || body.apply === 1);
  const mode = body.mode === "address" || body.mode === "geocode" ? body.mode : "clean";
  const runSeo = !(body.skipSeo === true || body.skipSeo === "true");
  const limit = Math.min(Math.max(parseInt(body.limit, 10) || 500, 1), 2000);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://zeva360.com";
  const urlFor = (slug) => (slug ? `${baseUrl}/clinics/${slug}` : null);

  try {
    const query = {
      isApproved: true,
      declined: false,
      name: { $exists: true, $nin: [null, ""] },
    };
    if (body.clinicId) query._id = body.clinicId;

    const clinics = await Clinic.find(query).sort({ createdAt: 1 }).limit(limit);

    const stats = {
      scanned: clinics.length,
      alreadyCorrect: 0,
      wouldUpdate: 0,
      updated: 0,
      unchanged: 0,
      skippedNoSlug: 0,
      skippedNoAddress: 0,
      skippedNoCity: 0,
      failed: 0,
      geocodeErrors: 0,
    };

    const results = [];
    const skipped = [];
    const failures = [];

    for (const clinic of clinics) {
      const entry = {
        id: String(clinic._id),
        name: clinic.name,
        currentSlug: clinic.slug || null,
        currentUrl: urlFor(clinic.slug),
      };

      // ------------------------------------------------------------------
      // mode=clean - strip a pasted URL from the stored slug, keep the slug text
      // ------------------------------------------------------------------
      if (mode === "clean") {
        if (!clinic.slug) {
          stats.skippedNoSlug++;
          skipped.push({ ...entry, reason: "clinic has no slug stored" });
          continue;
        }

        const cleaned = extractSlugFromUrl(clinic.slug);
        if (!cleaned) {
          // Already a single path segment: leave the URL exactly as it is.
          stats.alreadyCorrect++;
          continue;
        }

        // The recovered segment still has to satisfy slugService.validateSlug
        // (lowercase letters, numbers, single hyphens) before it can be locked, so
        // normalise it here. Nothing else about the clinic's link changes.
        const wantedSlug = slugify(cleaned);
        if (!wantedSlug) {
          stats.skippedNoSlug++;
          skipped.push({
            ...entry,
            reason: `stored slug "${clinic.slug}" holds no usable slug segment`,
          });
          continue;
        }

        const finalSlug = await ensureUniqueSlug(wantedSlug, clinic);
        const retiredSlug = clinic.slug;
        entry.cleanedSlug = finalSlug;
        entry.newUrl = urlFor(finalSlug);
        entry.retiredSlug = retiredSlug;

        if (!apply) {
          stats.wouldUpdate++;
          results.push(entry);
          continue;
        }

        try {
          // Keep the old value so a link that was already shared/indexed keeps
          // resolving instead of 404ing.
          clinic.previousSlugs = dedupe([...(clinic.previousSlugs || []), retiredSlug]);
          clinic.slug = finalSlug;
          await clinic.save();

          if (runSeo) {
            try {
              await runSEOPipeline("clinic", String(clinic._id), clinic);
            } catch (seoError) {
              // Non-fatal: the URL is already repaired.
              console.error("⚠️ SEO refresh after slug cleanup (non-fatal):", seoError.message);
            }
          }

          stats.updated++;
          entry.updated = true;
          results.push(entry);
        } catch (saveError) {
          stats.failed++;
          failures.push({
            ...entry,
            reason: `slug cleanup failed: ${saveError.message}`,
          });
        }
        continue;
      }

      // ------------------------------------------------------------------
      // mode=address | mode=geocode - move the clinic onto the name-city URL rule
      // ------------------------------------------------------------------
      const address = (clinic.address || "").trim();
      entry.address = address;

      if (!address) {
        stats.skippedNoAddress++;
        skipped.push({
          ...entry,
          reason: "no address stored — nothing to derive a city from",
        });
        continue;
      }

      let city = "";
      let fromGeocode = false;
      if (mode === "geocode") {
        try {
          city = await resolveCityViaGeocode(address);
          fromGeocode = !!city;
        } catch (geoError) {
          stats.geocodeErrors++;
          failures.push({ ...entry, reason: `geocode failed: ${geoError.message}` });
          await sleep(GEOCODE_PAUSE_MS);
          continue;
        }
        await sleep(GEOCODE_PAUSE_MS);

        // In geocode mode a miss is a miss: falling back to the first comma
        // segment would happily turn "L4,Block B, Chittaranjan Park" into a
        // clinic called "...-l4". Report it and let the clinic fix the address.
        if (!city) {
          stats.skippedNoCity++;
          skipped.push({
            ...entry,
            reason:
              "Google could not resolve a city for this address - update the Location field on the clinic profile, then re-run",
          });
          continue;
        }
      } else {
        // mode=address: trust the project-wide "City, <details>" convention.
        city = getCityFromAddress(address);
      }

      if (!city) {
        stats.skippedNoCity++;
        skipped.push({
          ...entry,
          reason: "no city could be derived from the stored address",
        });
        continue;
      }

      const citySlug = slugify(city);
      const expectedSlug = slugify(`${clinic.name} ${city}`);
      entry.city = city;
      entry.expectedSlug = expectedSlug;
      entry.expectedUrl = urlFor(expectedSlug);

      // Already name-city, and the stored slug is a clean single segment? Done.
      const slugHoldsUrl = !!extractSlugFromUrl(clinic.slug);
      if (!slugHoldsUrl && slugCarriesCity(clinic.slug, citySlug)) {
        stats.alreadyCorrect++;
        continue;
      }

      if (!apply) {
        stats.wouldUpdate++;
        results.push(entry);
        continue;
      }

      const slugBefore = clinic.slug || null;

      try {
        // Store the address the way the URL rule reads it, so a later profile edit
        // derives the same city instead of drifting.
        if (fromGeocode) {
          clinic.address = buildCityFirstAddress(address, city);
          await clinic.save();
        }

        // Reuse the shared services: never-approved / slugless clinics go through
        // the approval generator, locked ones through the location sync (which
        // retires the old slug for the 301).
        const outcome =
          !clinic.slug || !clinic.slugLocked
            ? await approveClinicSeo(String(clinic._id))
            : await syncClinicUrlWithLocation(String(clinic._id));

        // Report from the database rather than the service's return shape.
        const after = await Clinic.findById(clinic._id).lean();
        entry.newSlug = after?.slug || null;
        entry.newUrl = urlFor(after?.slug);
        entry.retiredSlug = slugBefore;
        entry.via = outcome?.urlUpdated === undefined ? "approveClinicSeo" : "syncClinicUrlWithLocation";

        if (entry.newSlug && entry.newSlug !== slugBefore) {
          stats.updated++;
          entry.updated = true;
          results.push(entry);
        } else {
          stats.unchanged++;
          skipped.push({ ...entry, reason: "service kept the existing URL (nothing to change)" });
        }
      } catch (clinicError) {
        stats.failed++;
        failures.push({ ...entry, reason: clinicError.message });
      }
    }

    return res.status(200).json({
      success: true,
      mode,
      apply,
      runSeo: mode === "clean" ? runSeo : true,
      limit,
      stats,
      note: apply
        ? "Changes written. Retired slugs are kept in previousSlugs and 301 via /api/clinics/by-slug/[slug]."
        : "Dry run - nothing was written. Send apply:true (POST) to apply these changes.",
      results: results.slice(0, 300),
      skipped: skipped.slice(0, 100),
      failures: failures.slice(0, 100),
    });
  } catch (error) {
    console.error("❌ Clinic URL backfill failed:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to backfill clinic URLs",
      error: error.message,
    });
  }
}
