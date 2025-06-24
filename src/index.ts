// src/index.ts - Simplified functional exports
/**
 * Threader - Multi-core JavaScript parallelism (Simplified Functional Implementation)
 */

// ============================================================================
// MAIN EXPORTS
// ============================================================================

// Core functional implementation
export {threader, cache, benchmark} from './threader'
export {thread} from './thread'

// Default export for convenience
import {threader} from './threader'
import {thread} from './thread'

export default {
  threader,
  thread
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  ThreadFunction,
  ThreadOptions,
  ThreadStatus,
  ThreadResult,
  ThreadResults,
  ThreadConfig
} from './types'

// Legacy type exports for compatibility
export type {ThreadResult as ThreadController} from './types'

// ============================================================================
// ERROR EXPORTS
// ============================================================================

export {
  ThreadValidationError,
  ThreadTimeoutError,
  ThreadCancelledError
} from './threader'

// ============================================================================
// UTILITY EXPORTS (FUNCTIONAL ONLY)
// ============================================================================

// Additional functional utilities for common patterns
export const pmap = async <T, R>(
  items: T[],
  fn: (item: T) => R | Promise<R>
): Promise<R[]> => {
  const {threader, thread} = await import('./threader')
  const processors = items.map(item => threader(fn, item))
  return thread.all(...processors)
}

export const pfilter = async <T>(
  items: T[],
  predicate: (item: T) => boolean | Promise<boolean>
): Promise<T[]> => {
  const {threader, thread} = await import('./threader')
  const processors = items.map(item => threader(predicate, item))
  const results = await thread.all(...processors)
  return items.filter((_, i) => results[i])
}

export const batch = async <T, R>(
  items: T[],
  fn: (item: T) => R | Promise<R>,
  batchSize: number = 10
): Promise<R[]> => {
  const {threader, thread} = await import('./threader')
  const results: R[] = []

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const processors = batch.map(item => threader(fn, item))
    const batchResults = await thread.all(...processors)
    results.push(...batchResults)
  }

  return results
}

// ============================================================================
// COMPATIBILITY EXPORTS
// ============================================================================

// Class export for compatibility (functional implementation)
export {threader as Threader} from './threader'

// Legacy naming
export {threader as createThreader} from './threader'
export {thread as threadExecutor} from './thread'
