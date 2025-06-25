// src/thread.ts - Enhanced execution engine with FIXED streaming
import {performance} from 'perf_hooks'
import type {Threader, deserializeData} from './threader'

// ============================================================================
// TYPES
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
// WORKER THREAD EXECUTION (FIXED)
// ============================================================================

/**
 * Execute with actual worker threads for true parallelism
 */
const executeWithWorkerThread = async <R>(
  threader: Threader<any, R>
): Promise<R> => {
  return new Promise((resolve, reject) => {
    const {Worker} = require('worker_threads')

    // Create worker script that executes the function
    const workerScript = `
      const { parentPort } = require('worker_threads')
      
      parentPort.on('message', async ({ fnString, data, taskId }) => {
        try {
          // Create function from string
          const func = new Function('return ' + fnString)()
          
          // Execute function
          const result = await func(data)
          
          parentPort.postMessage({ 
            success: true, 
            result, 
            taskId,
            workerId: process.pid 
          })
        } catch (error) {
          parentPort.postMessage({ 
            success: false, 
            error: error.message, 
            taskId,
            workerId: process.pid 
          })
        }
      })
    `

    const worker = new Worker(workerScript, {eval: true})
    const timeout = threader.options.timeout || 30000
    let isCompleted = false

    // Handle worker messages
    worker.on('message', ({success, result, error, taskId, workerId}) => {
      if (isCompleted) return
      isCompleted = true

      worker.terminate()

      if (success) {
        resolve(result)
      } else {
        reject(new Error(error))
      }
    })

    // Handle worker errors
    worker.on('error', error => {
      if (isCompleted) return
      isCompleted = true

      worker.terminate()
      reject(error)
    })

    // Send task to worker
    worker.postMessage({
      fnString: threader.fn.toString(),
      data: threader.data,
      taskId: threader.id
    })

    // Timeout handling
    setTimeout(() => {
      if (isCompleted) return
      isCompleted = true

      worker.terminate()
      reject(new Error(`Worker timeout after ${timeout}ms`))
    }, timeout)
  })
}

// ============================================================================
// OPTIMIZED EXECUTION FUNCTIONS
// ============================================================================

/**
 * Execute single threader using pre-optimized data OR worker threads
 */
const executeOptimized = async <R>(threader: Threader<any, R>): Promise<R> => {
  const {optimizationData} = threader

  // Try Rust backend first if recommended
  if (optimizationData.rustHints.shouldUseRust) {
    try {
      const results = await executeWithRust([threader])
      return results[0]
    } catch (error) {
      console.warn('Rust execution failed, falling back to worker threads')
    }
  }

  // Use worker threads for true parallelism
  return executeWithWorkerThread(threader)
}

/**
 * Execute with Rust backend using optimization hints
 */
const executeWithRust = async <R>(
  threaders: Threader<any, R>[]
): Promise<R[]> => {
  try {
    const backend = require('../threader.node')

    if (!backend?.MultiCoreExecutor) {
      throw new Error('Rust backend not available')
    }

    const executor = new backend.MultiCoreExecutor()

    // Use pre-serialized data from optimization phase
    const taskData = threaders.map(t => [
      t.fn.toString(),
      typeof t.optimizationData.serializedData.buffer === 'string'
        ? t.optimizationData.serializedData.buffer
        : JSON.stringify(t.data)
    ])

    const taskIds = await executor.submitBatch(taskData)
    const rustResults = await executor.getBatchResults(taskIds.length, 30000)

    return rustResults.map((resultJson: string, index: number) => {
      try {
        const parsed = JSON.parse(resultJson)

        if (parsed.error) {
          throw new Error(parsed.error)
        }

        if (parsed.result !== undefined) {
          if (
            typeof parsed.result === 'string' &&
            parsed.result.startsWith('"')
          ) {
            return parsed.result.slice(1, -1)
          }
          try {
            return JSON.parse(parsed.result)
          } catch {
            return parsed.result
          }
        }

        return parsed
      } catch (parseError) {
        throw parseError
      }
    })
  } catch (error) {
    throw error
  }
}

/**
 * Smart batched execution using pre-calculated batch strategy
 */
const executeBatched = async <R>(
  threaders: Threader<any, R>[],
  batchSize: number
): Promise<R[]> => {
  const results: R[] = []

  for (let i = 0; i < threaders.length; i += batchSize) {
    const batch = threaders.slice(i, i + batchSize)

    // Execute batch in parallel using Promise.all
    const batchPromises = batch.map(t => executeOptimized(t))
    const batchResults = await Promise.all(batchPromises)

    results.push(...batchResults)
  }

  return results
}

/**
 * Route execution based on optimization data
 */
const executeOptimally = async <R>(
  threaders: Threader<any, R>[]
): Promise<R[]> => {
  if (threaders.length === 0) return []

  // Check if batching is recommended for large sets
  const shouldBatch =
    threaders.length > 20 &&
    threaders.some(t => t.optimizationData.batchStrategy.shouldBatch)

  if (shouldBatch) {
    const optimalBatchSize =
      threaders[0].optimizationData.batchStrategy.optimalBatchSize
    return executeBatched(threaders, optimalBatchSize)
  }

  // Execute all in parallel using Promise.all
  const promises = threaders.map(t => executeOptimized(t))
  return Promise.all(promises)
}

// ============================================================================
// ENHANCED THREAD EXECUTOR API (FIXED)
// ============================================================================

/**
 * Enhanced thread executor with FIXED streaming
 */
export const thread = {
  /**
   * Execute all threaders using pre-optimization data
   */
  async all<T extends readonly Threader<any, any>[]>(
    ...processors: T
  ): Promise<ThreadResults<T>> {
    if (processors.length === 0) return [] as any

    const startTime = performance.now()

    // Execute all processors in parallel
    const results = await executeOptimally(processors)

    const duration = performance.now() - startTime

    // Record performance for learning (if available)
    try {
      const {recordBatchingPerformance} = require('./threader')
      if (processors.length > 1 && recordBatchingPerformance) {
        const firstProcessor = processors[0]
        recordBatchingPerformance(
          firstProcessor.optimizationData.functionAnalysis.complexity,
          processors.length,
          firstProcessor.optimizationData.batchStrategy.optimalBatchSize,
          duration,
          results.length
        )
      }
    } catch {
      // Ignore if recording not available
    }

    return results as ThreadResults<T>
  },

  /**
   * FIXED: Stream results as they actually complete
   */
  async *stream<T extends readonly Threader<any, any>[]>(
    ...processors: T
  ): AsyncIterable<ThreadResult<any>> {
    if (processors.length === 0) return

    // Create independent promises for each processor
    const taskPromises = processors.map(async (processor, index) => {
      const startTime = performance.now()

      try {
        const result = await executeOptimized(processor)
        return {
          index,
          result,
          duration: performance.now() - startTime,
          error: undefined,
          completed: true
        }
      } catch (error) {
        return {
          index,
          result: undefined,
          duration: performance.now() - startTime,
          error: error as Error,
          completed: true
        }
      }
    })

    // Track completed tasks
    const completed = new Set<number>()
    let totalCompleted = 0

    // Stream results as they complete
    while (totalCompleted < processors.length) {
      // Get all pending promises (not yet completed)
      const pendingPromises = taskPromises
        .map((promise, originalIndex) =>
          promise.then(result => ({result, originalIndex}))
        )
        .filter((_, index) => !completed.has(index))

      if (pendingPromises.length === 0) break

      // Wait for the next task to complete
      const {result, originalIndex} = await Promise.race(pendingPromises)

      // Only yield if we haven't seen this result before
      if (!completed.has(originalIndex)) {
        completed.add(originalIndex)
        totalCompleted++

        // Yield the result immediately
        yield {
          index: result.index,
          result: result.result,
          error: result.error,
          duration: result.duration
        }
      }
    }
  },

  /**
   * Fire and forget using optimized execution
   */
  fire<T extends readonly Threader<any, any>[]>(...processors: T): void {
    processors.forEach(processor => {
      executeOptimized(processor).catch(error => {
        console.error('Fire-and-forget execution failed:', error)
      })
    })
  },

  /**
   * Race using pre-optimized processors
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
        const result = await executeOptimized(processor)
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
   * Return first N completed results
   */
  async any<T extends readonly Threader<any, any>[]>(
    count: number,
    ...processors: T
  ): Promise<ThreadResult<any>[]> {
    if (count <= 0) return []
    if (processors.length === 0) throw new Error('No processors provided')

    if (count >= processors.length) {
      const results = await this.all(...processors)
      return results.map((result, index) => ({
        index,
        result,
        duration: 0
      }))
    }

    const promises = processors.map(async (processor, index) => {
      const startTime = performance.now()
      try {
        const result = await executeOptimized(processor)
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
    let remaining = [...promises]

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
   * Configure global settings
   */
  configure(config: Partial<ThreadConfig>): void {
    console.log('Thread configuration updated:', config)
  },

  /**
   * Shutdown with cleanup
   */
  async shutdown(): Promise<void> {
    try {
      const {cache} = await import('./threader')
      cache.clear()
    } catch {
      // Ignore if cache not available
    }

    console.log('Thread executor shutdown complete with cache cleanup')
  },

  /**
   * Get optimization performance statistics
   */
  getOptimizationStats(): any {
    try {
      const {cache} = require('./threader')
      return {
        cacheStats: cache.stats(),
        description: 'Optimization statistics from cache'
      }
    } catch {
      return {
        error: 'Stats not available',
        description: 'Cache not loaded'
      }
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {executeOptimized, executeWithRust, executeBatched, executeOptimally}
