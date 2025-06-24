// src/index.ts - Functional exports
/**
 * Threader - Multi-core JavaScript parallelism (Functional Implementation)
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

// ============================================================================
// COMPATIBILITY EXPORTS
// ============================================================================

// Class export for compatibility (functional implementation)
export {threader as Threader} from './threader'

// Legacy utilities (simplified or removed)
// Note: validation, serialization utilities are now internal to functional implementation
