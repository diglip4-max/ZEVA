import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * Normalizes an image path by handling backslashes, ensuring a leading slash,
 * and ignoring external URLs.
 * @param imagePath - The path or URL to normalize
 * @returns A normalized path or URL
 */
export function normalizeImagePath(imagePath: string): string {
  if (!imagePath) return "";
  let p = imagePath.replace(/\\/g, "/");
  if (p.startsWith("/")) return p;
  if (p.startsWith("http")) return p;
  return "/" + p;
}

/**
 * Generates a URL-friendly slug from text
 * @param text - The text to convert to slug
 * @returns A clean, URL-friendly slug
 */
export function slugify(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+/, '') // Remove leading hyphens
    .replace(/-+$/, ''); // Remove trailing hyphens
}

/**
 * Recovers the real slug from a stored value that accidentally holds a full URL.
 *
 * Legacy clinic records (and hand edits) sometimes saved things like
 * "zeva.com/sarthak" or "https://zeva360.com/clinics/foo" into the slug field.
 * The public clinic page is a single path segment, so that extra path made the
 * domain appear twice in the link (/clinics/zeva.com/sarthak).
 *
 * @param value - The stored slug, possibly a pasted URL
 * @returns The bare slug segment, or an empty string when there is nothing to repair
 */
export function extractSlugFromUrl(value: string): string {
  const raw = (value ?? '').toString().trim();
  if (!raw || !raw.includes('/')) return '';

  // "https://zeva360.com/clinics/foo" -> "/clinics/foo"
  const path = raw.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, '');

  const segments = path
    .split(/[?#]/)[0]
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .filter((segment) => !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(segment)) // hosts: zeva.com
    .filter((segment) => !/^clinics?$/i.test(segment)); // collection segment

  const slug = segments[segments.length - 1] || '';
  return slug === raw ? '' : slug;
}

/**
 * Generates a unique slug by appending a counter if the base slug exists
 * @param baseSlug - The base slug to make unique
 * @param checkExists - Function to check if slug exists
 * @returns A unique slug
 */
export async function generateUniqueSlug(
  baseSlug: string,
  checkExists: (slug: string) => Promise<boolean>
): Promise<string> {
  let finalSlug = baseSlug;
  let counter = 1;
  
  while (await checkExists(finalSlug)) {
    finalSlug = `${baseSlug}-${counter}`;
    counter++;
    
    // Safety limit to prevent infinite loops
    if (counter > 1000) {
      throw new Error('Unable to generate unique slug after 1000 attempts');
    }
  }
  
  return finalSlug;
}







