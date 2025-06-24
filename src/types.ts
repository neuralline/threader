// src/types.ts
import {Threader} from './threader'

/**
 * Function that can be executed in parallel across multiple threads
 */
export type ThreadFunction<T, R> = (data: T) => R | Promise<R>

/**
 * Configuration options for thread execution
 */
export interface ThreadOptions {
  /** Maximum execution time in milliseconds */
  timeout?: number
  /** Number of retry attempts on failure */
  retries?: number
  /** Execution priority (affects scheduling) */
  priority?: 'low' | 'normal' | 'high'
  /** Enable validation of function purity */
  validate?: boolean
}

/**
 * Status of a thread execution
 */
export type ThreadStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'cancelled'
  | 'error'

/**
 * Controller for managing thread execution
 */
export interface ThreadController {
  /** Cancel the execution */
  cancel(): Promise<void>
  /** Current execution status */
  readonly status: ThreadStatus
  /** Progress percentage (0-100) if available */
  readonly progress?: number
  /** Execution result when completed */
  readonly result?: unknown
  /** Error information if failed */
  readonly error?: Error
}

/**
 * Result of a single thread execution
 */
export interface ThreadResult<R> {
  /** Index of the threader in the input array */
  index: number
  /** Execution result */
  result: R
  /** Error if execution failed */
  error?: Error
  /** Execution time in milliseconds */
  duration: number
}

/**
 * Extract result types from array of Threader instances
 */
export type ThreadResults<T extends readonly Threader<any, any>[]> = {
  [K in keyof T]: T[K] extends Threader<any, infer R> ? R : never
}

/**
 * Main thread execution interface
 */
export interface ThreadExecutor {
  /**
   * Execute all threaders and wait for completion (like Promise.all)
   */
  all<T extends readonly Threader<any, any>[]>(
    ...processors: T
  ): Promise<ThreadResults<T>>

  /**
   * Execute threaders and yield results as they complete
   */
  stream<T extends readonly Threader<any, any>[]>(
    ...processors: T
  ): AsyncIterable<ThreadResult<any>>

  /**
   * Fire and forget - execute without waiting for results
   */
  fire<T extends readonly Threader<any, any>[]>(...processors: T): void

  /**
   * Return the first completed result (like Promise.race)
   */
  race<T extends readonly Threader<any, any>[]>(
    ...processors: T
  ): Promise<ThreadResult<any>>

  /**
   * Return the first N completed results
   */
  any<T extends readonly Threader<any, any>[]>(
    count: number,
    ...processors: T
  ): Promise<ThreadResult<any>[]>
}

/**
 * Configuration for the global thread execution engine
 */
export interface ThreadConfig {
  /** Maximum number of worker threads (defaults to CPU core count) */
  maxWorkers?: number
  /** Global timeout for all operations in milliseconds */
  timeout?: number
  /** Enable function validation by default */
  enableValidation?: boolean
  /** Memory transfer mode */
  transferMode?: 'auto' | 'clone' | 'transfer' | 'shared'
}
