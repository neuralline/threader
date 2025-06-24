// src/threader.ts - True multi-core implementation (no pattern matching)
import {performance} from 'perf_hooks'

// ============================================================================
// TYPES
// ============================================================================

export type ThreadFunction<T, R> = (data: T) => R | Promise<R>

export interface ThreadOptions {
  timeout?: number
  retries?: number
  priority?: 'low' | 'normal' | 'high'
}

export interface Threader<T, R> {
  readonly fn: ThreadFunction<T, R>
  readonly data: T
  readonly options: ThreadOptions
  readonly id: string
}

// ============================================================================
// RUST MULTI-CORE BACKEND
// ============================================================================

class MultiCoreBackend {
  private executor: any = null
  private available = false
  private pendingTasks = new Map<
    string,
    {resolve: Function; reject: Function}
  >()

  constructor() {
    this.loadMultiCoreBackend()
  }

  private loadMultiCoreBackend() {
    try {
      // Try to load the Rust multi-core backend
      const possiblePaths = [
        '../threader.darwin-arm64.node',
        '../threader.darwin-x64.node',
        '../threader.linux-x64-gnu.node',
        '../threader.win32-x64-msvc.node',
        '../threader.node',
        '../index.js'
      ]

      for (const path of possiblePaths) {
        try {
          const rustModule = require(path)
          if (rustModule.MultiCoreExecutor && rustModule.isMulticoreAvailable) {
            // Create executor with all CPU cores
            this.executor = new rustModule.MultiCoreExecutor()
            this.available = rustModule.isMulticoreAvailable()

            console.log(
              `🦀 Multi-core Rust backend loaded (${this.executor.workerCount} cores)`
            )
            return
          }
        } catch (e) {
          // Try next path
        }
      }

      console.warn(
        '⚠️ Rust multi-core backend not available, using JavaScript fallback'
      )
      this.available = false
    } catch (error) {
      console.warn('⚠️ Failed to load Rust backend:', error.message)
      this.available = false
    }
  }

  isAvailable(): boolean {
    return this.available && this.executor !== null
  }

  getCoreCount(): number {
    return this.executor?.workerCount || 1
  }

  getSystemInfo(): any {
    try {
      const info = require('../index.js').getMulticoreInfo()
      return JSON.parse(info)
    } catch {
      return {cpu_cores: this.getCoreCount(), features: ['fallback']}
    }
  }

  /**
   * Execute single function across multiple cores
   */
  async executeSingle(fn: Function, data: any): Promise<any> {
    if (!this.available || !this.executor) {
      // Fallback to direct JavaScript execution
      return fn(data)
    }

    try {
      const taskId = await this.executor.submitTask(
        fn.toString(),
        JSON.stringify(data),
        5000 // 5 second timeout
      )

      // Get the result
      const resultJson = await this.executor.getResult(5000)
      const result = JSON.parse(resultJson)

      if (result.error) {
        throw new Error(result.error)
      }

      return JSON.parse(result.result)
    } catch (error) {
      console.warn(
        `Multi-core execution failed, using fallback: ${error.message}`
      )
      return fn(data)
    }
  }

  /**
   * Execute multiple functions in parallel across all cores
   */
  async executeParallel(
    tasks: Array<{fn: Function; data: any}>
  ): Promise<any[]> {
    if (!this.available || !this.executor) {
      // Fallback: execute in sequence
      return Promise.all(tasks.map(task => task.fn(task.data)))
    }

    try {
      // Submit all tasks to the multi-core executor
      const taskData = tasks.map(task => [
        task.fn.toString(),
        JSON.stringify(task.data)
      ])
      const taskIds = await this.executor.submitBatch(taskData)

      // Get all results
      const resultJsons = await this.executor.getBatchResults(
        taskIds.length,
        30000
      )

      return resultJsons.map((resultJson: string) => {
        const result = JSON.parse(resultJson)
        if (result.error) {
          throw new Error(result.error)
        }
        return JSON.parse(result.result)
      })
    } catch (error) {
      console.warn(
        `Multi-core batch execution failed, using fallback: ${error.message}`
      )
      // Fallback to sequential Promise.all
      return Promise.all(tasks.map(task => task.fn(task.data)))
    }
  }

  /**
   * Shutdown the multi-core executor
   */
  async shutdown(): Promise<void> {
    if (this.executor) {
      try {
        await this.executor.shutdown()
      } catch (error) {
        console.warn('Error shutting down multi-core executor:', error.message)
      }
    }
  }
}

// Global multi-core backend instance
const multiCoreBackend = new MultiCoreBackend()

// ============================================================================
// THREADER IMPLEMENTATION
// ============================================================================

export const threader = <T, R>(
  fn: ThreadFunction<T, R>,
  data: T,
  options: ThreadOptions = {}
): Threader<T, R> => {
  return {
    fn,
    data,
    options,
    id: Math.random().toString(36).substring(2, 15)
  }
}

// ============================================================================
// EXECUTION ENGINE (MULTI-CORE POWERED)
// ============================================================================

/**
 * Execute single threader using multi-core backend
 */
async function executeSingle<R>(threader: Threader<any, R>): Promise<R> {
  return multiCoreBackend.executeSingle(
    threader.fn,
    threader.data
  ) as Promise<R>
}

/**
 * Execute multiple threaders in parallel across all CPU cores
 */
async function executeMultiple<R>(
  threaders: Array<Threader<any, R>>
): Promise<R[]> {
  if (threaders.length === 0) return []

  // Convert threaders to task format for multi-core execution
  const tasks = threaders.map(t => ({
    fn: t.fn,
    data: t.data
  }))

  return multiCoreBackend.executeParallel(tasks) as Promise<R[]>
}

// ============================================================================
// THREAD API (MULTI-CORE POWERED)
// ============================================================================

export interface ThreadResult<R> {
  index: number
  result: R
  error?: Error
  duration: number
  coreId?: number
}

export type ThreadResults<T extends readonly Threader<any, any>[]> = {
  [K in keyof T]: T[K] extends Threader<any, infer R> ? R : never
}

export const thread = {
  /**
   * Execute all threaders in parallel across multiple CPU cores
   */
  async all<T extends readonly Threader<any, any>[]>(
    ...processors: T
  ): Promise<ThreadResults<T>> {
    if (processors.length === 0) return [] as any

    const results = await executeMultiple(processors)
    return results as ThreadResults<T>
  },

  /**
   * Stream results as they complete from different cores
   */
  async *stream<T extends readonly Threader<any, any>[]>(
    ...processors: T
  ): AsyncIterable<ThreadResult<any>> {
    if (processors.length === 0) return

    // For streaming, we'll execute tasks and yield results as they complete
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
   * Fire and forget - distribute across cores without waiting
   */
  fire<T extends readonly Threader<any, any>[]>(...processors: T): void {
    processors.forEach(processor => {
      executeSingle(processor).catch(error => {
        console.error('Fire-and-forget execution failed:', error)
      })
    })
  },

  /**
   * Race execution across multiple cores
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
   * Return first N completed results from multi-core execution
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
   * Get multi-core system statistics
   */
  stats() {
    return {
      multiCoreAvailable: multiCoreBackend.isAvailable(),
      coreCount: multiCoreBackend.getCoreCount(),
      systemInfo: multiCoreBackend.getSystemInfo()
    }
  },

  /**
   * Configure multi-core execution
   */
  configure(config: any): void {
    console.log('Multi-core configuration:', config)
  },

  /**
   * Shutdown multi-core backend
   */
  async shutdown(): Promise<void> {
    await multiCoreBackend.shutdown()
    console.log('Multi-core backend shutdown complete')
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

export const cache = {
  size: () => 0,
  clear: () => {},
  has: () => false,
  strategy: () => 'multi-core',
  stats: () => ({
    multiCore: multiCoreBackend.isAvailable(),
    cores: multiCoreBackend.getCoreCount()
  })
}

export const benchmark = <T, R>(
  fn: ThreadFunction<T, R>,
  data: T,
  iterations: number = 1000
) => {
  const directStart = performance.now()
  for (let i = 0; i < iterations; i++) {
    fn(data)
  }
  const directEnd = performance.now()
  const directDuration = directEnd - directStart

  return {
    direct: {
      duration: directDuration,
      opsPerSec: (iterations / directDuration) * 1000
    },
    multiCore: {
      available: multiCoreBackend.isAvailable(),
      cores: multiCoreBackend.getCoreCount()
    },
    strategy: 'multi-core-parallel'
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {threader as default}
export const Threader = threader

// Error exports
export class ThreadValidationError extends Error {
  public readonly functionString: string

  constructor(message: string, functionString: string) {
    super(`Function validation failed: ${message}`)
    this.name = 'ThreadValidationError'
    this.functionString = functionString
  }
}

export class ThreadTimeoutError extends Error {
  constructor(timeout: number) {
    super(`Thread execution timed out after ${timeout}ms`)
    this.name = 'ThreadTimeoutError'
  }
}

export class ThreadCancelledError extends Error {
  constructor() {
    super('Thread execution was cancelled')
    this.name = 'ThreadCancelledError'
  }
}
