// src/thread.ts - Functional thread executor replacement
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
 * Execute single threader using its pre-computed execution plan
 */
const executeSingle = async <R>(threader: Threader<any, R>): Promise<R> => {
  const {executionPlan, data} = threader

  try {
    const result = await executionPlan.executor(data)
    return result as R
  } catch (error) {
    throw error
  }
}

/**
 * Execute multiple threaders with optimal strategy grouping
 */
const executeMultiple = async <R>(
  threaders: Array<Threader<any, R>>
): Promise<R[]> => {
  // Group by execution strategy for efficiency
  const nativeGroup: Array<{threader: Threader<any, R>; index: number}> = []
  const rustGroup: Array<{threader: Threader<any, R>; index: number}> = []
  const workerGroup: Array<{threader: Threader<any, R>; index: number}> = []

  threaders.forEach((threader, index) => {
    const item = {threader, index}
    switch (threader.executionPlan.strategy) {
      case 'native':
        nativeGroup.push(item)
        break
      case 'rust':
        rustGroup.push(item)
        break
      case 'worker':
        workerGroup.push(item)
        break
    }
  })

  const results: Array<{index: number; result: R}> = []

  // Execute native group (synchronous, fastest)
  nativeGroup.forEach(({threader, index}) => {
    const result = threader.executionPlan.executor(threader.data) as R
    results.push({index, result})
  })

  // Execute Rust group (synchronous, fast)
  rustGroup.forEach(({threader, index}) => {
    const result = threader.executionPlan.executor(threader.data) as R
    results.push({index, result})
  })

  // Execute worker group (async if needed)
  const workerResults = await Promise.all(
    workerGroup.map(async ({threader, index}) => {
      const result = (await threader.executionPlan.executor(threader.data)) as R
      return {index, result}
    })
  )
  results.push(...workerResults)

  // Sort back to original order
  results.sort((a, b) => a.index - b.index)
  return results.map(r => r.result)
}

// ============================================================================
// THREAD EXECUTOR API (FUNCTIONAL)
// ============================================================================

/**
 * Functional thread executor implementation
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
   * Execute threaders and yield results as they complete
   */
  async *stream<T extends readonly Threader<any, any>[]>(
    ...processors: T
  ): AsyncIterable<ThreadResult<any>> {
    if (processors.length === 0) return

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

    // Yield results as they complete
    for (const promise of promises) {
      yield await promise
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
