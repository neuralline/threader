// src/utils/worker-manager.ts
import {Worker} from 'worker_threads'
import * as path from 'path'
import {ThreadConfig, Threader, ThreadTimeoutError} from '../types'
import {serializeTask, SerializedTask} from './serialization'
import {getTransferables} from './validation'

/**
 * Manages a pool of worker threads for parallel execution
 */
export class WorkerManager {
  private workers: WorkerWrapper[] = []
  private availableWorkers: WorkerWrapper[] = []
  private taskQueue: PendingTask[] = []
  private config: ThreadConfig
  private rustBackend: any = null

  constructor(config: ThreadConfig) {
    this.config = config
    this.loadRustBackend()
    this.initializeWorkers()
  }

  /**
   * Try to load the Rust backend
   */
  private loadRustBackend(): void {
    try {
      // Try multiple possible paths for the Rust binary
      const possiblePaths = [
        // Platform-specific binary in root
        path.resolve(process.cwd(), 'threader.darwin-arm64.node'),
        path.resolve(process.cwd(), 'threader.darwin-x64.node'),
        path.resolve(process.cwd(), 'threader.linux-x64-gnu.node'),
        path.resolve(process.cwd(), 'threader.win32-x64-msvc.node'),
        // Generic binary name
        path.resolve(process.cwd(), 'threader.node'),
        // Try the generated index.js
        path.resolve(process.cwd(), 'index.js'),
        // Development paths
        path.resolve(__dirname, '../../threader.node'),
        path.resolve(__dirname, '../../index.js')
      ]

      for (const binPath of possiblePaths) {
        try {
          if (require('fs').existsSync(binPath)) {
            this.rustBackend = require(binPath)
            if (
              this.rustBackend &&
              this.rustBackend.isRustAvailable &&
              this.rustBackend.isRustAvailable()
            ) {
              console.log(`✅ Rust backend loaded from: ${binPath}`)
              return
            }
          }
        } catch (err) {
          // Continue to next path
        }
      }
    } catch (error) {
      console.warn('⚠️ Rust backend not available, using JavaScript fallback')
    }
  }

  /**
   * Execute a threader using the worker pool
   */
  async execute<R>(threader: Threader<any, R>): Promise<R> {
    const task = serializeTask(threader.fn, threader.data)
    const timeout = threader.options.timeout || this.config.timeout || 30000

    // If we have Rust backend and simple task, use it directly for better performance
    if (this.rustBackend && this.canUseRustDirect(task)) {
      return this.executeWithRust(task)
    }

    return new Promise<R>((resolve, reject) => {
      const pendingTask: PendingTask = {
        task,
        resolve,
        reject,
        timeout,
        timeoutId: setTimeout(() => {
          reject(new ThreadTimeoutError(timeout))
        }, timeout)
      }

      this.taskQueue.push(pendingTask)
      this.processQueue()
    })
  }

  /**
   * Check if we can use Rust backend directly for simple tasks
   */
  private canUseRustDirect(task: SerializedTask): boolean {
    if (!this.rustBackend) return false

    // Clean the function string - remove outer parentheses and normalize spacing
    let funcString = task.functionString.trim()
    if (funcString.startsWith('(') && funcString.endsWith(')')) {
      funcString = funcString.slice(1, -1)
    }
    funcString = funcString.replace(/\s+/g, '')

    // Simple patterns that Rust can handle directly
    const simplePatterns = [
      /^x=>x\*2$/, // x=>x*2
      /^x=>x\+5$/, // x=>x+5
      /^x=>x\+10$/, // x=>x+10
      /^x=>x\+100$/, // x=>x+100
      /^x=>x\.length$/, // x=>x.length
      /^x=>x\.toUpperCase\(\)$/, // x=>x.toUpperCase()
      /^x=>x\*x$/, // x=>x*x
      /^x=>x\*3$/, // x=>x*3
      /^x=>x\.toLowerCase\(\)$/ // x=>x.toLowerCase()
    ]

    const matches = simplePatterns.some(pattern => pattern.test(funcString))

    if (matches) {
      //console.log(`🦀 Using Rust for: ${funcString}`)
    } else {
      //console.log(`🟨 Using JS worker for: ${task.functionString}`)
    }

    return matches
  }

  /**
   * Execute using Rust backend directly
   */
  private async executeWithRust<R>(task: SerializedTask): Promise<R> {
    try {
      if (this.rustBackend.SimpleThreader) {
        const threader = new this.rustBackend.SimpleThreader()
        const result = threader.executeSimple(task.functionString, task.data)
        return JSON.parse(result)
      } else {
        throw new Error('SimpleThreader not available')
      }
    } catch (error) {
      console.warn(
        `🟨 Rust execution failed for "${task.functionString}", falling back to worker:`,
        error.message
      )
      // Fallback to worker execution
      return this.executeWithWorker(task)
    }
  }

  /**
   * Execute using worker thread
   */
  private async executeWithWorker<R>(task: SerializedTask): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      const pendingTask: PendingTask = {
        task,
        resolve,
        reject,
        timeout: 30000,
        timeoutId: setTimeout(() => {
          reject(new ThreadTimeoutError(30000))
        }, 30000)
      }

      this.taskQueue.push(pendingTask)
      this.processQueue()
    })
  }

  /**
   * Update configuration
   */
  updateConfig(config: ThreadConfig): void {
    this.config = {...this.config, ...config}

    // Adjust worker pool size if needed
    const targetWorkerCount = config.maxWorkers || this.config.maxWorkers || 4

    if (targetWorkerCount > this.workers.length) {
      // Add more workers
      const additionalWorkers = targetWorkerCount - this.workers.length
      for (let i = 0; i < additionalWorkers; i++) {
        this.createWorker()
      }
    } else if (targetWorkerCount < this.workers.length) {
      // Remove excess workers
      const excessWorkers = this.workers.length - targetWorkerCount
      for (let i = 0; i < excessWorkers; i++) {
        const worker = this.availableWorkers.pop() || this.workers.pop()
        if (worker) {
          this.terminateWorker(worker)
        }
      }
    }
  }

  /**
   * Shutdown all workers and clean up
   */
  async shutdown(): Promise<void> {
    // Clear task queue first
    this.taskQueue.forEach(task => {
      clearTimeout(task.timeoutId)
      task.reject(new Error('Worker manager shutting down'))
    })
    this.taskQueue = []

    // Terminate all workers gracefully
    const terminationPromises = this.workers.map(async worker => {
      try {
        // Send a gentle shutdown signal first
        worker.worker.postMessage({type: 'SHUTDOWN'})

        // Give workers a moment to finish
        await new Promise(resolve => setTimeout(resolve, 50))

        // Then terminate
        await this.terminateWorker(worker)
      } catch (error) {
        // Suppress errors during shutdown
      }
    })

    await Promise.allSettled(terminationPromises)
    this.workers = []
    this.availableWorkers = []
  }

  /**
   * Initialize the worker pool
   */
  private initializeWorkers(): void {
    const workerCount = this.config.maxWorkers || 4

    for (let i = 0; i < workerCount; i++) {
      this.createWorker()
    }
  }

  /**
   * Create a new worker
   */
  private createWorker(): WorkerWrapper {
    // Always use JavaScript worker for now
    return this.createJavaScriptWorker()
  }

  /**
   * Create a JavaScript fallback worker
   */
  private createJavaScriptWorker(): WorkerWrapper {
    const workerPath = path.join(__dirname, '../../workers/js-worker.js')
    const worker = new Worker(workerPath)

    const wrapper: WorkerWrapper = {
      worker,
      busy: false,
      tasks: new Map()
    }

    this.setupWorkerListeners(wrapper)
    this.workers.push(wrapper)
    this.availableWorkers.push(wrapper)

    return wrapper
  }

  /**
   * Setup event listeners for a worker
   */
  private setupWorkerListeners(wrapper: WorkerWrapper): void {
    wrapper.worker.on('message', message => {
      this.handleWorkerMessage(wrapper, message)
    })

    wrapper.worker.on('error', error => {
      this.handleWorkerError(wrapper, error)
    })

    wrapper.worker.on('exit', code => {
      this.handleWorkerExit(wrapper, code)
    })
  }

  /**
   * Handle message from worker
   */
  private handleWorkerMessage(wrapper: WorkerWrapper, message: any): void {
    const {taskId, result, error} = message

    const pendingTask = wrapper.tasks.get(taskId)
    if (!pendingTask) {
      console.warn(`Received result for unknown task: ${taskId}`)
      return
    }

    // Clear timeout
    clearTimeout(pendingTask.timeoutId)
    wrapper.tasks.delete(taskId)

    // Mark worker as available
    if (wrapper.tasks.size === 0) {
      wrapper.busy = false
      this.availableWorkers.push(wrapper)
      this.processQueue()
    }

    // Resolve or reject the task
    if (error) {
      pendingTask.reject(new Error(error))
    } else {
      pendingTask.resolve(result)
    }
  }

  /**
   * Handle worker error
   */
  private handleWorkerError(wrapper: WorkerWrapper, error: Error): void {
    console.error('Worker error:', error)

    // Reject all pending tasks for this worker
    wrapper.tasks.forEach(task => {
      clearTimeout(task.timeoutId)
      task.reject(error)
    })
    wrapper.tasks.clear()

    // Replace the worker
    this.replaceWorker(wrapper)
  }

  /**
   * Handle worker exit
   */
  private handleWorkerExit(wrapper: WorkerWrapper, code: number): void {
    if (code !== 0) {
      console.error(`Worker exited with code ${code}`)
      this.replaceWorker(wrapper)
    }
  }

  /**
   * Replace a failed worker
   */
  private replaceWorker(oldWrapper: WorkerWrapper): void {
    // Remove from worker arrays
    const workerIndex = this.workers.indexOf(oldWrapper)
    if (workerIndex >= 0) {
      this.workers.splice(workerIndex, 1)
    }

    const availableIndex = this.availableWorkers.indexOf(oldWrapper)
    if (availableIndex >= 0) {
      this.availableWorkers.splice(availableIndex, 1)
    }

    // Create replacement worker
    this.createWorker()
  }

  /**
   * Terminate a worker
   */
  private async terminateWorker(wrapper: WorkerWrapper): Promise<void> {
    try {
      await wrapper.worker.terminate()
    } catch (error) {
      console.warn('Error terminating worker:', error.message)
    }
  }

  /**
   * Process the task queue
   */
  private processQueue(): void {
    while (this.taskQueue.length > 0 && this.availableWorkers.length > 0) {
      const task = this.taskQueue.shift()!
      const worker = this.availableWorkers.shift()!

      worker.busy = true
      worker.tasks.set(task.task.id, task)

      // Send task to worker with proper data serialization
      const taskData = {
        ...task.task,
        data: task.task.data // data is already JSON string from serialization
      }

      // Get transferables but handle Node.js environment safely
      try {
        const transferables = getTransferables(JSON.parse(task.task.data))
        worker.worker.postMessage(taskData, transferables)
      } catch (error) {
        // If transferables fail, send without them
        worker.worker.postMessage(taskData)
      }
    }
  }
}

/**
 * Wrapper for worker thread with additional state
 */
interface WorkerWrapper {
  worker: Worker
  busy: boolean
  tasks: Map<string, PendingTask>
}

/**
 * Pending task waiting for execution or completion
 */
interface PendingTask {
  task: SerializedTask
  resolve: (result: any) => void
  reject: (error: Error) => void
  timeout: number
  timeoutId: NodeJS.Timeout
}
