// src/index.ts
/**
 * Threader - Multi-core JavaScript parallelism
 */
// Default export for convenience
import {threader} from './threader'
import {thread} from './thread'
// Main exports
export {threader} from './threader'
export {thread} from './thread'

// Type exports
export type {
  ThreadFunction,
  ThreadOptions,
  ThreadStatus,
  ThreadController,
  ThreadExecutor,
  ThreadResult,
  ThreadResults,
  ThreadConfig
} from './types'

// Class exports
export {Threader} from './threader'

// Error exports
export {
  ThreadValidationError,
  ThreadTimeoutError,
  ThreadCancelledError
} from './types'

// Utility exports (for advanced usage)
export {validateFunction, isTransferable} from './utils/validation'
export {serializeFunction, cloneData} from './utils/serialization'

export default {
  threader,
  thread
}
