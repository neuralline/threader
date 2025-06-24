// src/thread.ts
import {
  ThreadExecutor,
  ThreadResult,
  ThreadResults,
  Threader,
  ThreadConfig,
  ThreadTimeoutError,
  ThreadCancelledError
} from './types'
import {WorkerManager} from './utils/worker-manager'

/**
 * Implementation of the thread executor
 */
export class ThreadExecutorImpl implements ThreadExecutor {
  private workerManager: WorkerManager
  private config: ThreadConfig

  constructor(config: ThreadConfig = {}) {
    this.config = {
      maxWorkers: config.maxWorkers || require('os').cpus().length,
      timeout: config.timeout || 30000,
      enableValidation: config.enableValidation ?? true,
      transferMode: config.transferMode || 'auto',
      ...config
    }

    this.workerManager = new WorkerManager(this.config)
  }

  /**
   * Execute all threaders and wait for completion (like Promise.all)
   */
  async all<T extends readonly Threader<any, any>[]>(
    ...processors: T
  ): Promise<ThreadResults<T>> {
    if (processors.length === 0) {
      return [] as any
    }

    // Check for cancelled processors
    for (const processor of processors) {
      if (processor.isCancelled) {
        throw new ThreadCancelledError()
      }
    }

    try {
      // Execute all processors in parallel
      const promises = processors.map((processor, index) =>
        this.executeProcessor(processor, index)
      )

      const results = await Promise.all(promises)
      return results.map(r => r.result) as ThreadResults<T>
    } catch (error) {
      // Mark all processors as error state
      processors.forEach(p => {
        if (p.status === 'running' || p.status === 'pending') {
          p._setError(error as Error)
        }
      })
      throw error
    }
  }

  /**
   * Execute threaders and yield results as they complete
   */
  async *stream<T extends readonly Threader<any, any>[]>(
    ...processors: T
  ): AsyncIterable<ThreadResult<any>> {
    if (processors.length === 0) {
      return
    }

    // Start all executions
    const promises = processors.map((processor, index) =>
      this.executeProcessor(processor, index)
    )

    // Yield results as they complete
    while (promises.length > 0) {
      const {result, index} = await Promise.race(
        promises.map((promise, idx) =>
          promise.then(result => ({result, index: idx}))
        )
      )

      // Remove completed promise
      promises.splice(index, 1)

      yield result
    }
  }

  /**
   * Fire and forget - execute without waiting for results
   */
  fire<T extends readonly Threader<any, any>[]>(...processors: T): void {
    if (processors.length === 0) {
      return
    }

    // Start all executions without waiting
    processors.forEach((processor, index) => {
      this.executeProcessor(processor, index).catch(error => {
        // Log error but don't throw since it's fire-and-forget
        console.error(`Threader execution failed:`, error)
        processor._setError(error)
      })
    })
  }

  /**
   * Return the first completed result (like Promise.race)
   */
  async race<T extends readonly Threader<any, any>[]>(
    ...processors: T
  ): Promise<ThreadResult<any>> {
    if (processors.length === 0) {
      throw new Error('No processors provided to race')
    }

    const promises = processors.map((processor, index) =>
      this.executeProcessor(processor, index)
    )

    return Promise.race(promises)
  }

  /**
   * Return the first N completed results
   */
  async any<T extends readonly Threader<any, any>[]>(
    count: number,
    ...processors: T
  ): Promise<ThreadResult<any>[]> {
    if (count <= 0) {
      return []
    }

    if (processors.length === 0) {
      throw new Error('No processors provided')
    }

    if (count >= processors.length) {
      // If requesting all or more, just use all()
      const results = await this.all(...processors)
      return results.map((result, index) => ({
        index,
        result,
        duration: 0 // TODO: track actual duration
      }))
    }

    const promises = processors.map((processor, index) =>
      this.executeProcessor(processor, index)
    )

    const results: ThreadResult<any>[] = []
    const remaining = [...promises]

    while (results.length < count && remaining.length > 0) {
      const {result, index} = await Promise.race(
        remaining.map((promise, idx) =>
          promise.then(result => ({result, index: idx}))
        )
      )

      results.push(result)
      remaining.splice(index, 1)
    }

    return results
  }

  /**
   * Update global configuration
   */
  configure(config: Partial<ThreadConfig>): void {
    this.config = {...this.config, ...config}
    this.workerManager.updateConfig(this.config)
  }

  /**
   * Get current configuration
   */
  getConfig(): ThreadConfig {
    return {...this.config}
  }

  /**
   * Shutdown the thread executor and clean up resources
   */
  async shutdown(): Promise<void> {
    await this.workerManager.shutdown()
  }

  /**
   * Execute a single processor
   */
  private async executeProcessor<R>(
    processor: Threader<any, R>,
    index: number
  ): Promise<ThreadResult<R>> {
    const startTime = Date.now()

    try {
      // Check if already cancelled
      if (processor.isCancelled) {
        throw new ThreadCancelledError()
      }

      processor._setStatus('running')

      // Execute through worker manager
      const result = await this.workerManager.execute(processor)

      processor._setResult(result)

      return {
        index,
        result,
        duration: Date.now() - startTime
      }
    } catch (error) {
      processor._setError(error as Error)

      return {
        index,
        result: undefined as any,
        error: error as Error,
        duration: Date.now() - startTime
      }
    }
  }
}

/**
 * Default thread executor instance
 */
export const thread = new ThreadExecutorImpl()
