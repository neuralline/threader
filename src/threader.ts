// src/threader.ts - Pure functional approach (no classes, no complexity)
import {performance} from 'perf_hooks'
import {thread} from './thread'

// ============================================================================
// PURE FUNCTIONAL TYPES
// ============================================================================

export type ThreadFunction<T, R> = (data: T) => R | Promise<R>

export interface ThreadOptions {
  timeout?: number
}

export interface Threader<T, R> {
  readonly fn: ThreadFunction<T, R>
  readonly data: T
  readonly options: ThreadOptions
  readonly id: string
}

// ============================================================================
// PURE FUNCTIONAL STATE (IMMUTABLE)
// ============================================================================

interface BackendState {
  readonly executor: any | null
  readonly isAvailable: boolean
  readonly coreCount: number
}

let backendState: BackendState = {
  executor: null,
  isAvailable: false,
  coreCount: 1
}

// ============================================================================
// PURE FUNCTIONS FOR BACKEND DETECTION
// ============================================================================

const loadRustBackend = (): any | null => {
  const paths = [
    '../threader.darwin-arm64.node',
    '../threader.darwin-x64.node',
    '../threader.linux-x64-gnu.node',
    '../threader.win32-x64-msvc.node',
    '../threader.node',
    '../index.js'
  ]

  for (const path of paths) {
    try {
      const module = require(path)
      if (
        module.MultiCoreExecutor &&
        module.isMulticoreAvailable &&
        module.isMulticoreAvailable()
      ) {
        console.log(`🦀 Rust backend loaded from: ${path}`)
        return new module.MultiCoreExecutor()
      }
    } catch (e) {
      // Continue to next path
    }
  }

  return null
}

const initializeBackend = (): BackendState => {
  const executor = loadRustBackend()

  if (executor) {
    return {
      executor,
      isAvailable: true,
      coreCount: executor.workerCount || 1
    }
  } else {
    console.log('📦 Using JavaScript fallback')
    return {
      executor: null,
      isAvailable: false,
      coreCount: require('os').cpus().length
    }
  }
}

// Initialize once
backendState = initializeBackend()

// ============================================================================
// PURE FUNCTIONAL THREADER CREATION
// ============================================================================

export const threader = <T, R>(
  fn: ThreadFunction<T, R>,
  data: T,
  options: ThreadOptions = {}
): Threader<T, R> => ({
  fn,
  data,
  options,
  id: Math.random().toString(36).substring(2, 15)
})

// ============================================================================
// PURE FUNCTIONAL EXECUTION
// ============================================================================

const executeWithRust = async <R>(
  threaders: Threader<any, R>[]
): Promise<R[]> => {
  if (!backendState.executor) {
    throw new Error('No Rust backend available')
  }

  const taskData = threaders.map(t => [t.fn.toString(), JSON.stringify(t.data)])

  const taskIds = await backendState.executor.submitBatch(taskData)
  const rustResults = await backendState.executor.getBatchResults(
    taskIds.length,
    30000
  )

  return rustResults.map((resultJson: string, index: number) => {
    try {
      const parsed = JSON.parse(resultJson)

      if (parsed.error) {
        // Rust failed, fallback to JavaScript for this task
        return threaders[index].fn(threaders[index].data)
      }

      // Parse Rust result
      if (parsed.result !== undefined) {
        if (
          typeof parsed.result === 'string' &&
          parsed.result.startsWith('"')
        ) {
          return parsed.result.slice(1, -1) // Remove quotes
        }
        try {
          return JSON.parse(parsed.result)
        } catch {
          return parsed.result
        }
      }

      return parsed
    } catch (parseError) {
      // Parse failed, fallback to JavaScript
      return threaders[index].fn(threaders[index].data)
    }
  })
}

const executeWithJavaScript = async <R>(
  threaders: Threader<any, R>[]
): Promise<R[]> => Promise.all(threaders.map(t => t.fn(t.data)))

const executeOptimally = async <R>(
  threaders: Threader<any, R>[]
): Promise<R[]> => {
  if (threaders.length === 0) return []

  // Try Rust first, fallback to JavaScript if needed
  if (backendState.isAvailable) {
    try {
      return await executeWithRust(threaders)
    } catch (error) {
      console.warn('Rust execution failed, using JavaScript:', error.message)
      return await executeWithJavaScript(threaders)
    }
  } else {
    return await executeWithJavaScript(threaders)
  }
}

// ============================================================================
// PURE FUNCTIONAL THREAD API
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

// ============================================================================
// PURE FUNCTIONAL UTILITIES
// ============================================================================

export const cache = {
  size: () => 0, // No cache needed in pure functional approach
  clear: () => {},
  stats: () => ({size: 0})
}

export const benchmark = <T, R>(
  fn: ThreadFunction<T, R>,
  data: T,
  iterations: number = 1000
) => {
  const startTime = performance.now()

  for (let i = 0; i < iterations; i++) {
    fn(data)
  }

  const directTime = performance.now() - startTime
  const directOps = (iterations / directTime) * 1000

  return {
    direct: {
      timeMs: directTime,
      opsPerSec: directOps
    },
    backend: backendState.isAvailable ? 'rust' : 'javascript'
  }
}

// ============================================================================
// PURE FUNCTIONAL HELPERS
// ============================================================================

/**
 * Map over array in parallel
 */
export const pmap = async <T, R>(
  items: T[],
  fn: (item: T) => R | Promise<R>
): Promise<R[]> => {
  const processors = items.map(item => threader(fn, item))
  return thread.all(...processors)
}

/**
 * Filter array in parallel
 */
export const pfilter = async <T>(
  items: T[],
  predicate: (item: T) => boolean | Promise<boolean>
): Promise<T[]> => {
  const processors = items.map(item => threader(predicate, item))
  const results = await thread.all(...processors)
  return items.filter((_, i) => results[i])
}

/**
 * Reduce in parallel (for associative operations)
 */
export const preduce = async <T, R>(
  items: T[],
  fn: (acc: R, item: T) => R,
  initial: R
): Promise<R> => {
  if (items.length === 0) return initial
  if (items.length === 1) return fn(initial, items[0])

  // Split into chunks for parallel processing
  const chunkSize = Math.max(
    1,
    Math.floor(items.length / backendState.coreCount)
  )
  const chunks: T[][] = []

  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize))
  }

  // Process chunks in parallel
  const chunkReducer = (chunk: T[]) => chunk.reduce(fn, initial)
  const processors = chunks.map(chunk => threader(chunkReducer, chunk))
  const chunkResults = await thread.all(...processors)

  // Combine chunk results
  return chunkResults.reduce(fn, initial)
}

// ============================================================================
// ERROR CLASSES (FUNCTIONAL)
// ============================================================================
