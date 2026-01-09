/**
 * Central Slug Service - Entity-Agnostic, Rule-Driven
 * 
 * This service provides a unified slug generation and management system
 * that works for any entity type (clinic, doctor, blog, job, etc.)
 * 
 * Features:
 * - Entity-agnostic: Works with any model
 * - Rule-driven: Configurable rules per entity type
 * - Unique slug generation with collision handling
 * - Slug locking mechanism
 * - Validation and sanitization
 */

import dbConnect from './database';
import { slugify, generateUniqueSlug } from './utils';

// Entity configuration rules
const ENTITY_RULES = {
  clinic: {
    model: () => require('../models/Clinic').default,
    slugField: 'slug',
    lockField: 'slugLocked',
    sourceField: 'name', // Field to generate slug from
    requiresApproval: true, // Only generate slug when approved
    approvalField: 'isApproved',
    uniqueCheck: { slugLocked: true }, // Only check locked slugs for uniqueness
    routePrefix: '/clinics', // URL prefix for this entity
  },
  doctor: {
    model: () => require('../models/DoctorProfile').default,
    slugField: 'slug',
    lockField: 'slugLocked',
    sourceField: 'name', // Will need to populate from user.name
    requiresApproval: true,
    approvalField: 'isApproved',
    uniqueCheck: { slugLocked: true },
    routePrefix: '/doctors',
  },
  blog: {
    model: () => require('../models/Blog').default,
    slugField: 'paramlink', // Blog uses 'paramlink' instead of 'slug'
    lockField: 'slugLocked',
    sourceField: 'title',
    requiresApproval: false, // Blogs can have slugs in draft state
    approvalField: 'status',
    approvalValue: 'published', // Only check uniqueness for published blogs
    uniqueCheck: { status: 'published' },
    routePrefix: '/blog',
  },
  job: {
    model: () => require('../models/JobPosting').default,
    slugField: 'slug',
    lockField: 'slugLocked',
    sourceField: 'jobTitle',
    requiresApproval: true,
    approvalField: 'status',
    approvalValue: 'approved',
    uniqueCheck: { slugLocked: true, status: 'approved' },
    routePrefix: '/jobs',
  },
};

/**
 * Get entity rule configuration
 * @param {string} entityType - The entity type (clinic, doctor, blog, job)
 * @returns {Object} Entity rule configuration
 */
export function getEntityRule(entityType) {
  const rule = ENTITY_RULES[entityType];
  if (!rule) {
    throw new Error(`Unknown entity type: ${entityType}. Supported types: ${Object.keys(ENTITY_RULES).join(', ')}`);
  }
  return rule;
}

/**
 * Get the source text for slug generation
 * @param {Object} entity - The entity document
 * @param {Object} rule - Entity rule configuration
 * @returns {string} Source text for slug
 */
async function getSourceText(entity, rule) {
  let sourceText = entity[rule.sourceField];
  
  // Special handling for doctor (needs to get name from user)
  if (rule.sourceField === 'name' && entity.user) {
    const User = require('../models/Users').default;
    
    // If user is populated (object), use it directly
    if (typeof entity.user === 'object' && entity.user.name) {
      sourceText = entity.user.name;
    } 
    // If user is just an ObjectId, fetch it
    else if (typeof entity.user === 'object' && entity.user._id) {
      const user = await User.findById(entity.user._id);
      sourceText = user?.name || sourceText;
    }
    // If user is a string/ObjectId, fetch it
    else if (typeof entity.user === 'string' || entity.user.toString) {
      const user = await User.findById(entity.user);
      sourceText = user?.name || sourceText;
    }
  }
  
  if (!sourceText) {
    throw new Error(`Source field '${rule.sourceField}' is empty or not found for ${entity.constructor?.modelName || 'entity'}`);
  }
  
  return sourceText;
}

/**
 * Check if slug exists for an entity
 * @param {string} slug - The slug to check
 * @param {string} entityType - The entity type
 * @param {string} excludeId - Entity ID to exclude from check
 * @returns {Promise<boolean>} True if slug exists
 */
async function checkSlugExists(slug, entityType, excludeId = null) {
  await dbConnect();
  const rule = getEntityRule(entityType);
  const Model = rule.model();
  
  const query = {
    [rule.slugField]: slug,
    ...rule.uniqueCheck,
  };
  
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  
  const existing = await Model.findOne(query);
  return !!existing;
}

/**
 * Generate a unique slug for an entity
 * @param {string} entityType - The entity type
 * @param {string} entityId - The entity ID
 * @param {Object} options - Additional options
 * @param {string} options.customText - Custom text to use instead of source field
 * @param {boolean} options.forceRegenerate - Force regeneration even if slug exists
 * @returns {Promise<Object>} Generated slug information
 */
export async function generateSlug(entityType, entityId, options = {}) {
  await dbConnect();
  const rule = getEntityRule(entityType);
  const Model = rule.model();
  
  // Fetch the entity - populate user for doctor to check approval
  let entity;
  if (entityType === 'doctor') {
    const User = require('../models/Users').default;
    entity = await Model.findById(entityId).populate('user', 'isApproved name');
  } else {
    entity = await Model.findById(entityId);
  }
  
  if (!entity) {
    throw new Error(`${entityType} not found with ID: ${entityId}`);
  }
  
  // Check if slug is already locked
  if (entity[rule.lockField] && !options.forceRegenerate) {
    return {
      slug: entity[rule.slugField],
      locked: true,
      message: 'Slug already locked',
    };
  }
  
  // Check approval requirement
  if (rule.requiresApproval) {
    const approvalValue = rule.approvalValue || true;
    let isApproved = false;
    
    // Special handling for doctor - approval is in user.isApproved, not in DoctorProfile
    if (entityType === 'doctor') {
      // User should be populated from the query above
      if (entity.user && typeof entity.user === 'object') {
        isApproved = entity.user.isApproved === approvalValue;
      } else {
        // Fallback: fetch user if not populated
        const User = require('../models/Users').default;
        const userId = typeof entity.user === 'object' ? entity.user._id : entity.user;
        const user = await User.findById(userId).select('isApproved');
        isApproved = user?.isApproved === approvalValue;
      }
    } 
    // For other entities (clinic, blog, job), check approval field directly
    else {
      isApproved = rule.approvalField === 'status' 
        ? entity[rule.approvalField] === approvalValue
        : entity[rule.approvalField] === approvalValue;
    }
    
    if (!isApproved) {
      throw new Error(`${entityType} must be approved before generating slug`);
    }
  }
  
  // Get source text for slug generation
  const sourceText = options.customText || await getSourceText(entity, rule);
  
  // Generate base slug
  const baseSlug = slugify(sourceText);
  if (!baseSlug) {
    throw new Error(`Unable to generate slug from source text: ${sourceText}`);
  }
  
  // Generate unique slug
  const checkExists = (slugToCheck) => checkSlugExists(slugToCheck, entityType, entityId);
  const finalSlug = await generateUniqueSlug(baseSlug, checkExists);
  
  return {
    slug: finalSlug,
    locked: false,
    message: 'Slug generated successfully',
  };
}

/**
 * Lock a slug for an entity (prevent future changes)
 * @param {string} entityType - The entity type
 * @param {string} entityId - The entity ID
 * @param {string} slug - The slug to lock
 * @returns {Promise<Object>} Updated entity
 */
export async function lockSlug(entityType, entityId, slug) {
  await dbConnect();
  const rule = getEntityRule(entityType);
  const Model = rule.model();
  
  // Verify slug doesn't exist for another entity
  const exists = await checkSlugExists(slug, entityType, entityId);
  if (exists) {
    throw new Error(`Slug '${slug}' already exists for another ${entityType}`);
  }
  
  // Update entity with slug and lock
  const update = {
    [rule.slugField]: slug,
    [rule.lockField]: true,
  };
  
  const entity = await Model.findByIdAndUpdate(
    entityId,
    update,
    { new: true, runValidators: true }
  );
  
  if (!entity) {
    throw new Error(`${entityType} not found with ID: ${entityId}`);
  }
  
  return entity;
}

/**
 * Generate and lock slug in one operation
 * @param {string} entityType - The entity type
 * @param {string} entityId - The entity ID
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Updated entity with slug
 */
export async function generateAndLockSlug(entityType, entityId, options = {}) {
  const slugResult = await generateSlug(entityType, entityId, options);
  
  if (slugResult.locked) {
    // Slug already locked, return existing entity
    await dbConnect();
    const rule = getEntityRule(entityType);
    const Model = rule.model();
    return await Model.findById(entityId);
  }
  
  // Lock the generated slug
  return await lockSlug(entityType, entityId, slugResult.slug);
}

/**
 * Find entity by slug
 * @param {string} entityType - The entity type
 * @param {string} slug - The slug to search for
 * @returns {Promise<Object|null>} Found entity or null
 */
export async function findBySlug(entityType, slug) {
  await dbConnect();
  const rule = getEntityRule(entityType);
  const Model = rule.model();
  
  const entity = await Model.findOne({
    [rule.slugField]: slug,
  });
  
  return entity;
}

/**
 * Get route URL for an entity based on its slug
 * @param {string} entityType - The entity type
 * @param {string} slug - The slug
 * @returns {string} Full route URL
 */
export function getEntityRoute(entityType, slug) {
  const rule = getEntityRule(entityType);
  return `${rule.routePrefix}/${slug}`;
}

/**
 * Validate slug format
 * @param {string} slug - The slug to validate
 * @returns {Object} Validation result
 */
export function validateSlug(slug) {
  if (!slug || typeof slug !== 'string') {
    return { valid: false, error: 'Slug must be a non-empty string' };
  }
  
  // Slug should be lowercase, alphanumeric with hyphens only
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  
  if (!slugRegex.test(slug)) {
    return { 
      valid: false, 
      error: 'Slug must contain only lowercase letters, numbers, and hyphens' 
    };
  }
  
  if (slug.length < 3) {
    return { valid: false, error: 'Slug must be at least 3 characters long' };
  }
  
  if (slug.length > 100) {
    return { valid: false, error: 'Slug must be less than 100 characters' };
  }
  
  return { valid: true };
}

/**
 * Get all supported entity types
 * @returns {string[]} Array of supported entity types
 */
export function getSupportedEntityTypes() {
  return Object.keys(ENTITY_RULES);
}

