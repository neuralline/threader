// src/utils/worker-manager.ts - Updated functional drop-in replacement
import {Worker} from 'worker_threads'
import * as path from 'path'
import * as os from 'os'
import type {Threader, ThreadConfig, ThreadTimeoutError} from '../types'

// ============================================================================
// PURE FUNCTIONAL WORKER MANAGER (Updated for 2-Phase Architecture)
// ============================================================================

export interface WorkerManagerState {
  readonly workers: ReadonlyArray<WorkerInstance>
  readonly availableWorkers: ReadonlyArray<WorkerInstance>
  readonly taskQueue: ReadonlyArray<PendingTask>
  readonly config: ThreadConfig
  readonly rustBackend: any | null
  readonly isShuttingDown: boolean
}

export interface WorkerInstance {
  readonly id: string
  readonly worker: Worker
  readonly busy: boolean
  readonly tasks: ReadonlyMap<string, PendingTask>
  readonly createdAt: number
  readonly executionCount: number
}

export interface PendingTask {
  readonly taskId: string
  readonly threader: Threader<any, any>
  readonly resolve: (result: any) => void
  readonly reject: (error: Error) => void
  readonly timeout: number
  readonly timeoutId: NodeJS.Timeout
  readonly startTime: number
}

export interface WorkerManagerAPI {
  readonly execute: <R>(threader: Threader<any, R>) => Promise<R>
  readonly executeBatch: <R>(
    threaders: ReadonlyArray<Threader<any, R>>
  ) => Promise<R[]>
  readonly updateConfig: (config: Partial<ThreadConfig>) => WorkerManagerAPI
  readonly shutdown: () => Promise<void>
  readonly getStats: () => WorkerStats
}

export interface WorkerStats {
  readonly totalWorkers: number
  readonly availableWorkers: number
  readonly queuedTasks: number
  readonly totalExecutions: number
  readonly rustBackendAvailable: boolean
}

// ============================================================================
// RUST BACKEND INTEGRATION (Pure Functions)
// ============================================================================

const loadRustBackend = (): any | null => {
  const possiblePaths = [
    // Platform-specific binaries
    path.resolve(process.cwd(), 'threader.darwin-arm64.node'),
    path.resolve(process.cwd(), 'threader.darwin-x64.node'),
    path.resolve(process.cwd(), 'threader.linux-x64-gnu.node'),
    path.resolve(process.cwd(), 'threader.win32-x64-msvc.node'),
    // Generic paths
    path.resolve(process.cwd(), 'threader.node'),
    path.resolve(process.cwd(), 'index.js'),
    // Development paths
    path.resolve(__dirname, '../../threader.node'),
    path.resolve(__dirname, '../../index.js')
  ]

  for (const binPath of possiblePaths) {
    try {
      if (require('fs').existsSync(binPath)) {
        const backend = require(binPath)
        if (
          backend?.OptimizedMultiCoreExecutor &&
          backend.is_optimized_multicore_available?.()
        ) {
          console.log(`🦀 Enhanced Rust backend loaded: ${binPath}`)
          return new backend.OptimizedMultiCoreExecutor()
        }
        // Fallback to simple backend
        if (backend?.MultiCoreExecutor && backend.isMulticoreAvailable?.()) {
          console.log(`🦀 Basic Rust backend loaded: ${binPath}`)
          return new backend.MultiCoreExecutor()
        }
      }
    } catch (error) {
      // Continue to next path
    }
  }

  console.log('📦 Rust backend not available, using JavaScript workers')
  return null
}

const canUseRustBackend = (threader: Threader<any, any>): boolean => {
  const {rustHints} = threader.optimizationData
  return rustHints.shouldUseRust
}

const executeWithRust = async <R>(
  rustBackend: any,
  threader: Threader<any, R>
): Promise<R> => {
  try {
    const {optimizationData} = threader

    // Use enhanced Rust backend if available
    if (rustBackend.submit_optimized_task) {
      const optimizationHints = JSON.stringify({
        operation_type: optimizationData.rustHints.operationType,
        complexity: optimizationData.functionAnalysis.complexity,
        expected_cores: optimizationData.rustHints.expectedCores,
        should_use_rust: true,
        is_hot_function: optimizationData.functionAnalysis.isHotFunction,
        estimated_memory: optimizationData.functionAnalysis.estimatedMemory,
        batch_size_hint: optimizationData.batchStrategy.optimalBatchSize,
        function_hash: optimizationData.functionAnalysis.fnHash
      })

      const taskId = await rustBackend.submit_optimized_task(
        threader.fn.toString(),
        optimizationData.serializedData.format === 'json'
          ? optimizationData.serializedData.buffer
          : JSON.stringify(threader.data),
        optimizationHints
      )

      const resultJson = await rustBackend.get_optimized_result(30000)
      const parsed = JSON.parse(resultJson)

      if (parsed.error) {
        throw new Error(parsed.error)
      }

      return parseRustResult(parsed.result)
    }

    // Fallback to basic Rust backend
    if (rustBackend.submitTask) {
      const taskId = await rustBackend.submitTask(
        threader.fn.toString(),
        optimizationData.serializedData.format === 'json'
          ? optimizationData.serializedData.buffer
          : JSON.stringify(threader.data)
      )

      const resultJson = await rustBackend.getResult(30000)
      const parsed = JSON.parse(resultJson)

      if (parsed.error) {
        throw new Error(parsed.error)
      }

      return parseRustResult(parsed.result)
    }

    throw new Error('Rust backend not properly initialized')
  } catch (error) {
    // Fall back to JavaScript worker
    throw new Error(`Rust execution failed: ${error.message}`)
  }
}

const parseRustResult = (result: any): any => {
  if (typeof result === 'string') {
    // Handle quoted strings from Rust
    if (result.startsWith('"') && result.endsWith('"')) {
      return result.slice(1, -1)
    }
    // Try parsing as JSON
    try {
      return JSON.parse(result)
    } catch {
      return result
    }
  }
  return result
}

// ============================================================================
// WORKER THREAD MANAGEMENT (Pure Functions)
// ============================================================================

const createWorkerInstance = (id: string): WorkerInstance => {
  const workerPath = path.join(__dirname, '../../workers/js-worker.js')
  const worker = new Worker(workerPath)

  return {
    id,
    worker,
    busy: false,
    tasks: new Map(),
    createdAt: Date.now(),
    executionCount: 0
  }
}

const updateWorkerInstance = (
  worker: WorkerInstance,
  updates: Partial<Pick<WorkerInstance, 'busy' | 'executionCount'>>
): WorkerInstance => ({
  ...worker,
  ...updates
})

const addTaskToWorker = (
  worker: WorkerInstance,
  taskId: string,
  task: PendingTask
): WorkerInstance => ({
  ...worker,
  tasks: new Map(worker.tasks.set(taskId, task)),
  busy: true
})

const removeTaskFromWorker = (
  worker: WorkerInstance,
  taskId: string
): WorkerInstance => {
  const newTasks = new Map(worker.tasks)
  newTasks.delete(taskId)

  return {
    ...worker,
    tasks: newTasks,
    busy: newTasks.size > 0,
    executionCount: worker.executionCount + 1
  }
}

const executeWithWorkerThread = async <R>(
  state: WorkerManagerState,
  threader: Threader<any, R>
): Promise<R> => {
  return new Promise<R>((resolve, reject) => {
    const taskId = `task_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`
    const timeout = threader.options.timeout || state.config.timeout || 30000

    const timeoutId = setTimeout(() => {
      reject(new Error(`Worker timeout after ${timeout}ms`))
    }, timeout)

    const pendingTask: PendingTask = {
      taskId,
      threader,
      resolve,
      reject,
      timeout,
      timeoutId,
      startTime: Date.now()
    }

    // Add to queue - actual processing handled by state management
    processTaskQueue({
      ...state,
      taskQueue: [...state.taskQueue, pendingTask]
    })
  })
}

const processTaskQueue = (state: WorkerManagerState): WorkerManagerState => {
  if (state.taskQueue.length === 0 || state.availableWorkers.length === 0) {
    return state
  }

  const [nextTask, ...remainingTasks] = state.taskQueue
  const [availableWorker, ...remainingAvailable] = state.availableWorkers

  // Assign task to worker
  const updatedWorker = addTaskToWorker(
    availableWorker,
    nextTask.taskId,
    nextTask
  )

  // Send optimized task to worker
  const taskMessage = {
    id: nextTask.taskId,
    fnString: nextTask.threader.fn.toString(),
    data:
      nextTask.threader.optimizationData.serializedData.format === 'json'
        ? nextTask.threader.optimizationData.serializedData.buffer
        : JSON.stringify(nextTask.threader.data),
    serializedData: nextTask.threader.optimizationData.serializedData,
    optimizationHints: {
      operationType: nextTask.threader.optimizationData.rustHints.operationType,
      complexity:
        nextTask.threader.optimizationData.functionAnalysis.complexity,
      isHotFunction:
        nextTask.threader.optimizationData.functionAnalysis.isHotFunction,
      estimatedMemory:
        nextTask.threader.optimizationData.functionAnalysis.estimatedMemory
    },
    timeout: nextTask.timeout
  }

  // Send with transferables if available
  try {
    const transferables =
      nextTask.threader.optimizationData.serializedData.transferables || []
    updatedWorker.worker.postMessage(taskMessage, transferables)
  } catch (error) {
    updatedWorker.worker.postMessage(taskMessage)
  }

  return {
    ...state,
    taskQueue: remainingTasks,
    availableWorkers: remainingAvailable,
    workers: state.workers.map(w =>
      w.id === updatedWorker.id ? updatedWorker : w
    )
  }
}

// ============================================================================
// MAIN WORKER MANAGER API (Pure Functional)
// ============================================================================

export const createWorkerManager = (
  config: ThreadConfig = {}
): WorkerManagerAPI => {
  // Initialize state
  let state: WorkerManagerState = {
    workers: [],
    availableWorkers: [],
    taskQueue: [],
    config: {
      maxWorkers: config.maxWorkers || Math.max(1, os.cpus().length - 1),
      timeout: config.timeout || 30000,
      enableValidation: config.enableValidation || false,
      transferMode: config.transferMode || 'auto'
    },
    rustBackend: loadRustBackend(),
    isShuttingDown: false
  }

  // Initialize workers
  const workerCount = state.config.maxWorkers!
  const initialWorkers = Array.from({length: workerCount}, (_, i) =>
    createWorkerInstance(`worker_${i}`)
  )

  // Setup worker event listeners
  initialWorkers.forEach(setupWorkerListeners)

  state = {
    ...state,
    workers: initialWorkers,
    availableWorkers: [...initialWorkers]
  }

  // ============================================================================
  // EVENT HANDLERS (Pure Functions)
  // ============================================================================

  function setupWorkerListeners(workerInstance: WorkerInstance): void {
    workerInstance.worker.on('message', (message: any) => {
      handleWorkerMessage(workerInstance.id, message)
    })

    workerInstance.worker.on('error', (error: Error) => {
      handleWorkerError(workerInstance.id, error)
    })

    workerInstance.worker.on('exit', (code: number) => {
      handleWorkerExit(workerInstance.id, code)
    })
  }

  function handleWorkerMessage(workerId: string, message: any): void {
    if (state.isShuttingDown) return

    const {taskId, success, result, error, duration} = message
    const worker = state.workers.find(w => w.id === workerId)
    const task = worker?.tasks.get(taskId)

    if (!worker || !task) {
      console.warn(`Received result for unknown task: ${taskId}`)
      return
    }

    // Clear timeout
    clearTimeout(task.timeoutId)

    // Update worker state
    const updatedWorker = removeTaskFromWorker(worker, taskId)

    state = {
      ...state,
      workers: state.workers.map(w => (w.id === workerId ? updatedWorker : w)),
      availableWorkers: updatedWorker.busy
        ? state.availableWorkers
        : [...state.availableWorkers, updatedWorker]
    }

    // Resolve/reject task
    if (success) {
      task.resolve(result)
    } else {
      task.reject(new Error(error || 'Worker execution failed'))
    }

    // Process next task in queue
    state = processTaskQueue(state)
  }

  function handleWorkerError(workerId: string, error: Error): void {
    console.error(`Worker ${workerId} error:`, error)
    replaceWorker(workerId)
  }

  function handleWorkerExit(workerId: string, code: number): void {
    if (code !== 0 && !state.isShuttingDown) {
      console.error(`Worker ${workerId} exited with code ${code}`)
      replaceWorker(workerId)
    }
  }

  function replaceWorker(workerId: string): void {
    const worker = state.workers.find(w => w.id === workerId)
    if (!worker) return

    // Reject all pending tasks for this worker
    worker.tasks.forEach(task => {
      clearTimeout(task.timeoutId)
      task.reject(new Error('Worker failed and was replaced'))
    })

    // Create replacement worker
    const newWorker = createWorkerInstance(`worker_${Date.now()}`)
    setupWorkerListeners(newWorker)

    state = {
      ...state,
      workers: state.workers.map(w => (w.id === workerId ? newWorker : w)),
      availableWorkers: state.availableWorkers
        .filter(w => w.id !== workerId)
        .concat(newWorker)
    }
  }

  // ============================================================================
  // PUBLIC API (Pure Functions)
  // ============================================================================

  const execute = async <R>(threader: Threader<any, R>): Promise<R> => {
    if (state.isShuttingDown) {
      throw new Error('Worker manager is shutting down')
    }

    // Use pre-calculated optimization hints from 2-phase system
    if (state.rustBackend && canUseRustBackend(threader)) {
      try {
        return await executeWithRust(state.rustBackend, threader)
      } catch (error) {
        console.warn(
          `Rust execution failed, falling back to worker: ${error.message}`
        )
        // Fall through to worker execution
      }
    }

    // Execute with JavaScript worker using optimized data
    return executeWithWorkerThread(state, threader)
  }

  const executeBatch = async <R>(
    threaders: ReadonlyArray<Threader<any, R>>
  ): Promise<R[]> => {
    if (threaders.length === 0) return []

    // Use pre-calculated batching strategy from first threader
    const batchStrategy = threaders[0]?.optimizationData.batchStrategy

    if (
      batchStrategy?.shouldBatch &&
      threaders.length > batchStrategy.optimalBatchSize
    ) {
      // Process in optimal batches
      const results: R[] = []
      for (
        let i = 0;
        i < threaders.length;
        i += batchStrategy.optimalBatchSize
      ) {
        const batch = threaders.slice(i, i + batchStrategy.optimalBatchSize)
        const batchResults = await Promise.all(batch.map(execute))
        results.push(...batchResults)
      }
      return results
    }

    // Execute all in parallel
    return Promise.all(threaders.map(execute))
  }

  const updateConfig = (newConfig: Partial<ThreadConfig>): WorkerManagerAPI => {
    const updatedConfig = {...state.config, ...newConfig}

    // Handle worker count changes
    const targetWorkerCount = updatedConfig.maxWorkers!
    const currentWorkerCount = state.workers.length

    if (targetWorkerCount > currentWorkerCount) {
      // Add workers
      const additionalWorkers = Array.from(
        {length: targetWorkerCount - currentWorkerCount},
        (_, i) => createWorkerInstance(`worker_${Date.now()}_${i}`)
      )
      additionalWorkers.forEach(setupWorkerListeners)

      state = {
        ...state,
        config: updatedConfig,
        workers: [...state.workers, ...additionalWorkers],
        availableWorkers: [...state.availableWorkers, ...additionalWorkers]
      }
    } else if (targetWorkerCount < currentWorkerCount) {
      // Remove excess workers
      const excessWorkers = state.workers.slice(targetWorkerCount)
      excessWorkers.forEach(worker => {
        worker.worker.terminate()
      })

      state = {
        ...state,
        config: updatedConfig,
        workers: state.workers.slice(0, targetWorkerCount),
        availableWorkers: state.availableWorkers.filter(
          w => !excessWorkers.some(ew => ew.id === w.id)
        )
      }
    } else {
      state = {...state, config: updatedConfig}
    }

    return createWorkerManager(updatedConfig)
  }

  const shutdown = async (): Promise<void> => {
    state = {...state, isShuttingDown: true}

    // Clear task queue
    state.taskQueue.forEach(task => {
      clearTimeout(task.timeoutId)
      task.reject(new Error('Worker manager shutting down'))
    })

    // Shutdown all workers gracefully
    const shutdownPromises = state.workers.map(async worker => {
      try {
        worker.worker.postMessage({type: 'SHUTDOWN'})
        await new Promise(resolve => setTimeout(resolve, 100))
        await worker.worker.terminate()
      } catch (error) {
        // Suppress shutdown errors
      }
    })

    await Promise.allSettled(shutdownPromises)

    // Clear state
    state = {
      ...state,
      workers: [],
      availableWorkers: [],
      taskQueue: []
    }
  }

  const getStats = (): WorkerStats => ({
    totalWorkers: state.workers.length,
    availableWorkers: state.availableWorkers.length,
    queuedTasks: state.taskQueue.length,
    totalExecutions: state.workers.reduce(
      (sum, w) => sum + w.executionCount,
      0
    ),
    rustBackendAvailable: !!state.rustBackend
  })

  return {
    execute,
    executeBatch,
    updateConfig,
    shutdown,
    getStats
  }
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export const createOptimizedWorkerManager = createWorkerManager

// Singleton instance for global use (optional)
let globalWorkerManager: WorkerManagerAPI | null = null

export const getGlobalWorkerManager = (
  config?: ThreadConfig
): WorkkerManagerAPI => {
  if (!globalWorkerManager) {
    globalWorkerManager = createWorkerManager(config)
  }
  return globalWorkerManager
}

export const shutdownGlobalWorkerManager = async (): Promise<void> => {
  if (globalWorkerManager) {
    await globalWorkerManager.shutdown()
    globalWorkerManager = null
  }
}
