/**
 * Robots Meta Service
 * 
 * Purpose: Consistent meta robots tags
 * 
 * Returns appropriate robots meta tag based on indexing decision
 */

import { IndexingDecision } from './IndexingService';

export interface RobotsMeta {
  content: string;
  noindex: boolean;
  nofollow: boolean;
  noarchive?: boolean;
  nosnippet?: boolean;
}

/**
 * Get robots meta tag based on indexing decision
 */
export function getRobotsMeta(decision: IndexingDecision): RobotsMeta {
  // If should not index, return noindex
  if (!decision.shouldIndex) {
    return {
      content: 'noindex, nofollow',
      noindex: true,
      nofollow: true,
    };
  }

  // Based on priority
  switch (decision.priority) {
    case 'high':
      // High priority: index and follow
      return {
        content: 'index, follow',
        noindex: false,
        nofollow: false,
      };

    case 'medium':
      // Medium priority: index but nofollow if warnings exist
      if (decision.warnings.length > 0) {
        return {
          content: 'index, nofollow',
          noindex: false,
          nofollow: true,
        };
      }
      return {
        content: 'index, follow',
        noindex: false,
        nofollow: false,
      };

    case 'low':
      // Low priority: noindex
      return {
        content: 'noindex, nofollow',
        noindex: true,
        nofollow: true,
      };

    default:
      return {
        content: 'index, follow',
        noindex: false,
        nofollow: false,
      };
  }
}

/**
 * Generate robots meta tag string
 */
export function generateRobotsMetaString(decision: IndexingDecision): string {
  const meta = getRobotsMeta(decision);
  return meta.content;
}

/**
 * Get robots meta for entity
 */
export async function getRobotsMetaForEntity(
  entityType: 'clinic' | 'doctor',
  entityId: string,
  decision?: IndexingDecision
): Promise<RobotsMeta> {
  const { decideIndexing } = await import('./IndexingService');
  const indexingDecision = decision || await decideIndexing(entityType, entityId);
  return getRobotsMeta(indexingDecision);
}

