// src/thread.ts - Simplified functional thread executor
import {performance} from 'perf_hooks'
import type {Threader} from './threader'

// ============================================================================
// TYPES (Same API)
// ============================================================================

export interface ThreadResult<R> {
  index: number
  result: R
  error?: Error
  duration: number
}

export type ThreadResults<T extends readonly Threader<any, any>[]> = {
  [K in keyof T]: T[K] extends Threader<any, infer R> ? R : never
}

export interface ThreadConfig {
  maxWorkers?: number
  timeout?: number
  enableValidation?: boolean
  transferMode?: 'auto' | 'clone' | 'transfer' | 'shared'
}

// ============================================================================
// FUNCTIONAL EXECUTION (NO WORKER MANAGEMENT OVERHEAD)
// ============================================================================

/**
 * Execute single threader directly - no overhead
 */
const executeSingle = async <R>(threader: Threader<any, R>): Promise<R> => {
  try {
    const result = await threader.fn(threader.data)
    return result as R
  } catch (error) {
    throw error
  }
}

/**
 * Execute multiple threaders in parallel - pure Promise.all
 */
const executeMultiple = async <R>(
  threaders: readonly Threader<any, R>[]
): Promise<R[]> => {
  // Simple parallel execution using Promise.all
  const promises = threaders.map(t => executeSingle(t))
  return Promise.all(promises)
}

// ============================================================================
// THREAD EXECUTOR API (FUNCTIONAL)
// ============================================================================

/**
 * Simplified functional thread executor
 */
export const thread = {
  /**
   * Execute all threaders and wait for completion (like Promise.all)
   */
  async all<T extends readonly Threader<any, any>[]>(
    ...processors: T
  ): Promise<ThreadResults<T>> {
    if (processors.length === 0) return [] as any

    const results = await executeMultiple(processors)
    return results as ThreadResults<T>
  },

  /**
   * Stream results as they complete - PURE INDIVIDUAL EXECUTION
   */
  async *stream<T extends readonly Threader<any, any>[]>(
    ...processors: T
  ): AsyncIterable<ThreadResult<any>> {
    if (processors.length === 0) return

    // BYPASS ALL BATCHING - Execute each processor completely independently
    const individualPromises = processors.map(async (processor, index) => {
      const startTime = performance.now()

      try {
        // DIRECT EXECUTION - No routing through executeOptimally or any batch system
        const result = await processor.fn(processor.data)
        return {
          index,
          result,
          duration: performance.now() - startTime
        }
      } catch (error) {
        return {
          index,
          result: undefined,
          error: error as Error,
          duration: performance.now() - startTime
        }
      }
    })

    // Race the individual promises as they complete
    let remaining = individualPromises.map((promise, originalIndex) => ({
      promise,
      originalIndex
    }))

    while (remaining.length > 0) {
      const completed = await Promise.race(
        remaining.map(({promise, originalIndex}, arrayIndex) =>
          promise.then(result => ({result, arrayIndex, originalIndex}))
        )
      )

      yield completed.result

      // Remove the completed promise from remaining array
      remaining.splice(completed.arrayIndex, 1)
    }
  },

  /**
   * Fire and forget - execute without waiting for results
   */
  fire<T extends readonly Threader<any, any>[]>(...processors: T): void {
    processors.forEach(processor => {
      executeSingle(processor).catch(error => {
        console.error('Fire-and-forget execution failed:', error)
      })
    })
  },

  /**
   * Return the first completed result (like Promise.race)
   */
  async race<T extends readonly Threader<any, any>[]>(
    ...processors: T
  ): Promise<ThreadResult<any>> {
    if (processors.length === 0) {
      throw new Error('No processors provided to race')
    }

    const promises = processors.map(async (processor, index) => {
      const startTime = performance.now()
      try {
        const result = await executeSingle(processor)
        return {
          index,
          result,
          duration: performance.now() - startTime
        }
      } catch (error) {
        return {
          index,
          result: undefined,
          error: error as Error,
          duration: performance.now() - startTime
        }
      }
    })

    return Promise.race(promises)
  },

  /**
   * Return the first N completed results
   */
  async any<T extends readonly Threader<any, any>[]>(
    count: number,
    ...processors: T
  ): Promise<ThreadResult<any>[]> {
    if (count <= 0) return []
    if (processors.length === 0) throw new Error('No processors provided')

    // If requesting all or more, just use all()
    if (count >= processors.length) {
      const results = await this.all(...processors)
      return results.map((result, index) => ({
        index,
        result,
        duration: 0 // Could track actual duration
      }))
    }

    const promises = processors.map(async (processor, index) => {
      const startTime = performance.now()
      try {
        const result = await executeSingle(processor)
        return {
          index,
          result,
          duration: performance.now() - startTime
        }
      } catch (error) {
        return {
          index,
          result: undefined,
          error: error as Error,
          duration: performance.now() - startTime
        }
      }
    })

    const results: ThreadResult<any>[] = []
    const remaining = [...promises]

    while (results.length < count && remaining.length > 0) {
      const completed = await Promise.race(
        remaining.map((promise, idx) =>
          promise.then(result => ({result, promiseIndex: idx}))
        )
      )

      results.push(completed.result)
      remaining.splice(completed.promiseIndex, 1)
    }

    return results
  },

  /**
   * Configure global settings (simplified)
   */
  configure(config: Partial<ThreadConfig>): void {
    // In functional version, configuration is minimal
    console.log('Thread configuration updated:', config)
  },

  /**
   * Shutdown - no cleanup needed in functional version
   */
  async shutdown(): Promise<void> {
    // No worker pools to shutdown in functional version
    console.log('Thread executor shutdown complete')
  }
}
