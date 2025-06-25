// src/threader.ts - Enhanced with 2-Phase Optimization Pipeline (Pure Functional)
import {performance} from 'perf_hooks'
import msgpack from 'msgpack-lite'

// ============================================================================
// ENHANCED TYPES WITH OPTIMIZATION DATA
// ============================================================================

export type ThreadFunction<T, R> = (data: T) => R | Promise<R>

export interface ThreadOptions {
  timeout?: number
  preferBinary?: boolean
  disableOptimization?: boolean
  batchHint?: 'single' | 'small' | 'medium' | 'large'
}

export interface OptimizedThreader<T, R> {
  readonly fn: ThreadFunction<T, R>
  readonly data: T
  readonly options: ThreadOptions
  readonly id: string

  // OPTIMIZATION DATA (prepared in threader() phase)
  readonly optimizationData: {
    serializedData: {
      buffer: ArrayBuffer | string
      format: 'binary' | 'json'
      transferables?: Transferable[]
    }
    functionAnalysis: {
      complexity: 'low' | 'medium' | 'high'
      isAsync: boolean
      estimatedMemory: number
      moduleDetections: string[]
      isHotFunction: boolean
      fnHash: string
    }
    batchStrategy: {
      optimalBatchSize: number
      shouldBatch: boolean
      priority: number
    }
    rustHints: {
      shouldUseRust: boolean
      operationType: string
      expectedCores: number
    }
  }
}

export type Threader<T, R> = OptimizedThreader<T, R>

// ============================================================================
// BINARY PROTOCOL (PURE FUNCTIONS)
// ============================================================================

// Global state for performance tracking (immutable updates)
let binaryProtocolStats = new Map<
  string,
  {time: number; size: number; count: number}
>()

const estimateDataSize = (data: any): number => {
  try {
    return new Blob([JSON.stringify(data)]).size
  } catch {
    return 1000 // Default estimate
  }
}

const extractTransferables = (data: any): Transferable[] => {
  const transferables: Transferable[] = []

  const findTransferables = (obj: any, visited = new Set()) => {
    if (visited.has(obj) || obj === null || typeof obj !== 'object') return
    visited.add(obj)

    if (obj instanceof ArrayBuffer || obj instanceof MessagePort) {
      transferables.push(obj)
      return
    }

    if (Array.isArray(obj)) {
      obj.forEach(item => findTransferables(item, visited))
    } else {
      Object.values(obj).forEach(value => findTransferables(value, visited))
    }
  }

  try {
    findTransferables(data)
  } catch {
    // Ignore errors in transferable detection
  }

  return transferables
}

const isComplexObject = (data: any): boolean => {
  return (
    typeof data === 'object' &&
    data !== null &&
    (Array.isArray(data) || Object.keys(data).length > 5)
  )
}

const recordBinaryPerformance = (
  format: 'binary' | 'json',
  time: number,
  size: number
) => {
  const key = `${format}_${size > 1024 ? 'large' : 'small'}`
  const existing = binaryProtocolStats.get(key) || {time: 0, size: 0, count: 0}

  binaryProtocolStats = new Map(
    binaryProtocolStats.set(key, {
      time: (existing.time * existing.count + time) / (existing.count + 1),
      size: (existing.size * existing.count + size) / (existing.count + 1),
      count: existing.count + 1
    })
  )
}

const serializeData = (
  data: any,
  preferBinary: boolean = false
): {
  buffer: ArrayBuffer | string
  format: 'binary' | 'json'
  transferables?: Transferable[]
} => {
  const startTime = performance.now()
  const dataSize = estimateDataSize(data)
  const transferables = extractTransferables(data)

  // Intelligent format selection
  const shouldUseBinary =
    preferBinary ||
    dataSize > 1024 ||
    transferables.length > 0 ||
    isComplexObject(data)

  let result: {
    buffer: ArrayBuffer | string
    format: 'binary' | 'json'
    transferables?: Transferable[]
  }

  if (shouldUseBinary) {
    try {
      const encoded = msgpack.encode(data)
      result = {
        buffer: encoded.buffer.slice(
          encoded.byteOffset,
          encoded.byteOffset + encoded.byteLength
        ),
        format: 'binary',
        transferables: transferables.length > 0 ? transferables : undefined
      }
    } catch (error) {
      // Fallback to JSON if binary fails
      result = {
        buffer: JSON.stringify(data),
        format: 'json'
      }
    }
  } else {
    result = {
      buffer: JSON.stringify(data),
      format: 'json'
    }
  }

  // Record performance for learning
  const endTime = performance.now()
  recordBinaryPerformance(result.format, endTime - startTime, dataSize)

  return result
}

const deserializeData = (
  buffer: ArrayBuffer | string,
  format: 'binary' | 'json'
): any => {
  if (format === 'binary') {
    return msgpack.decode(new Uint8Array(buffer as ArrayBuffer))
  }
  return JSON.parse(buffer as string)
}

// ============================================================================
// FUNCTION ANALYSIS (PURE FUNCTIONS)
// ============================================================================

// Global state for function analysis cache
let functionAnalysisCache = new Map<string, any>()
let hotFunctionTracker = new Map<string, number>()

const hashFunction = (fnString: string): string => {
  let hash = 0
  for (let i = 0; i < fnString.length; i++) {
    const char = fnString.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return hash.toString()
}

const detectModuleUsage = (fnString: string): string[] => {
  const modules: string[] = []
  const patterns = [
    /require\(['"`]([^'"`]+)['"`]\)/g,
    /import.*from\s*['"`]([^'"`]+)['"`]/g,
    /import\(['"`]([^'"`]+)['"`]\)/g
  ]

  patterns.forEach(pattern => {
    let match
    while ((match = pattern.exec(fnString)) !== null) {
      modules.push(match[1])
    }
  })

  return modules
}

const estimateComplexity = (fnString: string): 'low' | 'medium' | 'high' => {
  const length = fnString.length
  const hasLoops = /for\s*\(|while\s*\(|\.map\(|\.filter\(|\.reduce\(/i.test(
    fnString
  )
  const hasAsync = /async|await|Promise|\.then\(/i.test(fnString)
  const hasHeavyOps = /require|import|eval|Function/i.test(fnString)

  if (length > 500 || hasHeavyOps) return 'high'
  if (length > 100 || hasLoops || hasAsync) return 'medium'
  return 'low'
}

const estimateMemoryUsage = (fnString: string, dataSize: number): number => {
  const baseMemory = dataSize
  const hasArrayOps = /\.map\(|\.filter\(|\.concat\(/i.test(fnString)
  const hasStringOps = /\.split\(|\.join\(|\.replace\(/i.test(fnString)

  let multiplier = 1
  if (hasArrayOps) multiplier += 0.5
  if (hasStringOps) multiplier += 0.3

  return Math.floor(baseMemory * multiplier)
}

const trackHotFunction = (fnHash: string): number => {
  const currentCount = hotFunctionTracker.get(fnHash) || 0
  const newCount = currentCount + 1
  hotFunctionTracker = new Map(hotFunctionTracker.set(fnHash, newCount))
  return newCount
}

const analyzeFunction = <T, R>(fn: ThreadFunction<T, R>, dataSize: number) => {
  const fnString = fn.toString()
  const fnHash = hashFunction(fnString)

  // Check cache first
  if (functionAnalysisCache.has(fnHash)) {
    const cached = functionAnalysisCache.get(fnHash)!
    const usage = trackHotFunction(fnHash)
    return {...cached, isHotFunction: usage > 10, fnHash}
  }

  // Analyze function
  const analysis = {
    complexity: estimateComplexity(fnString),
    isAsync: /async|await|Promise|\.then\(/i.test(fnString),
    estimatedMemory: estimateMemoryUsage(fnString, dataSize),
    moduleDetections: detectModuleUsage(fnString),
    isHotFunction: false,
    fnHash
  }

  // Cache the analysis
  functionAnalysisCache = new Map(functionAnalysisCache.set(fnHash, analysis))

  const usage = trackHotFunction(fnHash)
  return {...analysis, isHotFunction: usage > 10}
}

// ============================================================================
// ADAPTIVE BATCHING (PURE FUNCTIONS)
// ============================================================================

// Global state for batching performance
let batchingHistory = new Map<
  string,
  Array<{
    batchSize: number
    taskCount: number
    totalTime: number
    throughput: number
  }>
>()

let optimalBatchSizes = new Map<string, number>()

const getBatchingKey = (complexity: string, taskCount: number): string => {
  const scale =
    taskCount > 1000 ? 'large' : taskCount > 100 ? 'medium' : 'small'
  return `${complexity}_${scale}`
}

const getDefaultBatchSize = (
  complexity: 'low' | 'medium' | 'high',
  taskCount: number
): number => {
  const defaults = {
    low: Math.min(taskCount, 100),
    medium: Math.min(taskCount, 50),
    high: Math.min(taskCount, 10)
  }
  return defaults[complexity]
}

const calculateOptimalBatchSize = (
  complexity: 'low' | 'medium' | 'high',
  taskCount: number
): number => {
  const key = getBatchingKey(complexity, taskCount)

  // Use learned optimal size if available
  if (optimalBatchSizes.has(key)) {
    return optimalBatchSizes.get(key)!
  }

  return getDefaultBatchSize(complexity, taskCount)
}

const calculateBatchStrategy = (
  functionAnalysis: any,
  taskCount: number = 1
) => {
  const optimalBatchSize = calculateOptimalBatchSize(
    functionAnalysis.complexity,
    taskCount
  )

  const shouldBatch = taskCount > 20 && functionAnalysis.complexity !== 'high'

  const priority = functionAnalysis.isHotFunction
    ? 1
    : functionAnalysis.complexity === 'low'
    ? 2
    : 3

  return {
    optimalBatchSize,
    shouldBatch,
    priority
  }
}

const recordBatchingPerformance = (
  complexity: 'low' | 'medium' | 'high',
  taskCount: number,
  batchSize: number,
  totalTime: number,
  resultCount: number
) => {
  const key = getBatchingKey(complexity, taskCount)

  const performance = {
    batchSize,
    taskCount,
    totalTime,
    throughput: (resultCount / totalTime) * 1000
  }

  const history = batchingHistory.get(key) || []
  const newHistory = [...history, performance].slice(-20) // Keep last 20 entries

  batchingHistory = new Map(batchingHistory.set(key, newHistory))

  // Update optimal batch size based on best throughput
  if (newHistory.length >= 5) {
    const bestPerformance = newHistory.reduce((best, current) =>
      current.throughput > best.throughput ? current : best
    )
    optimalBatchSizes = new Map(
      optimalBatchSizes.set(key, bestPerformance.batchSize)
    )
  }
}

// ============================================================================
// RUST HINTS (PURE FUNCTIONS)
// ============================================================================

const determineOperationType = (fnString: string): string => {
  if (/math\.|Math\./i.test(fnString)) return 'mathematical'
  if (/\.map\(|\.filter\(|\.reduce\(/i.test(fnString)) return 'array_operations'
  if (/require\(['"`]sharp['"`]\)|require\(['"`]jimp['"`]\)/i.test(fnString))
    return 'image_processing'
  if (/\.toUpperCase\(|\.toLowerCase\(|\.split\(/i.test(fnString))
    return 'string_operations'
  return 'general'
}

const shouldUseRustBackend = (
  functionAnalysis: any,
  operationType: string
): boolean => {
  // Don't use Rust for complex operations that need full JS environment
  if (functionAnalysis.moduleDetections.length > 0) return false
  if (functionAnalysis.complexity === 'high') return false
  if (functionAnalysis.isAsync) return false

  // Use Rust for simple, synchronous operations
  const rustOptimalTypes = [
    'mathematical',
    'string_operations',
    'array_operations'
  ]
  return rustOptimalTypes.includes(operationType)
}

const estimateExpectedCores = (
  complexity: 'low' | 'medium' | 'high'
): number => {
  const availableCores = require('os').cpus().length

  switch (complexity) {
    case 'low':
      return Math.min(availableCores, 8)
    case 'medium':
      return Math.min(availableCores, 4)
    case 'high':
      return Math.min(availableCores, 2)
    default:
      return 1
  }
}

const generateRustHints = (functionAnalysis: any) => {
  const operationType = determineOperationType(functionAnalysis.fnHash)

  return {
    shouldUseRust: shouldUseRustBackend(functionAnalysis, operationType),
    operationType,
    expectedCores: estimateExpectedCores(functionAnalysis.complexity)
  }
}

// ============================================================================
// JIT OPTIMIZATION HINTS (PURE FUNCTIONS)
// ============================================================================

const applyJITHints = <T, R>(
  fn: ThreadFunction<T, R>,
  isHotFunction: boolean
): ThreadFunction<T, R> => {
  if (!isHotFunction) return fn

  // For hot functions, create an optimized wrapper
  const optimizedFn = (data: T): R | Promise<R> => {
    'use strict'

    // V8 optimization hints (these are implementation-specific)
    try {
      // Warm up the function for better JIT compilation
      if ((optimizedFn as any).__warmupDone !== true) {
        // Dummy warmup calls
        for (let i = 0; i < 3; i++) {
          try {
            fn({} as T)
          } catch {
            /* ignore warmup errors */
          }
        }
        ;(optimizedFn as any).__warmupDone = true
      }
    } catch {
      // Ignore warmup errors
    }

    return fn(data)
  }

  return optimizedFn
}

// ============================================================================
// BACKEND STATE MANAGEMENT
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

// Initialize backend state once
backendState = initializeBackend()

// ============================================================================
// ENHANCED THREADER FUNCTION (2-PHASE OPTIMIZATION)
// ============================================================================

export const threader = <T, R>(
  fn: ThreadFunction<T, R>,
  data: T,
  options: ThreadOptions = {}
): Threader<T, R> => {
  // PHASE 1: PREPARATION & OPTIMIZATION

  // 1. Binary Protocol Optimization
  const serializedData = serializeData(data, options.preferBinary)

  // 2. Function Analysis
  const dataSize = estimateDataSize(data)
  const functionAnalysis = analyzeFunction(fn, dataSize)

  // 3. JIT Optimization Hints
  const optimizedFn = options.disableOptimization
    ? fn
    : applyJITHints(fn, functionAnalysis.isHotFunction)

  // 4. Adaptive Batching Strategy
  const batchStrategy = calculateBatchStrategy(functionAnalysis)

  // 5. Rust Backend Hints
  const rustHints = generateRustHints(functionAnalysis)

  // 6. Warm up Rust backend if beneficial
  if (rustHints.shouldUseRust && backendState.isAvailable) {
    // Send optimization hints to Rust backend
    try {
      backendState.executor?.optimizeForWorkload?.(
        rustHints.operationType,
        rustHints.expectedCores
      )
    } catch {
      // Ignore if backend doesn't support optimization hints
    }
  }

  // Return optimized threader with all preparation complete
  return {
    fn: optimizedFn,
    data,
    options,
    id: Math.random().toString(36).substring(2, 15),
    optimizationData: {
      serializedData,
      functionAnalysis,
      batchStrategy,
      rustHints
    }
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const cache = {
  size: () => functionAnalysisCache.size + binaryProtocolStats.size,
  clear: () => {
    functionAnalysisCache = new Map()
    binaryProtocolStats = new Map()
    hotFunctionTracker = new Map()
    batchingHistory = new Map()
    optimalBatchSizes = new Map()
  },
  stats: () => ({
    functionAnalysisCache: functionAnalysisCache.size,
    binaryProtocolStats: binaryProtocolStats.size,
    hotFunctions: Array.from(hotFunctionTracker.entries()).filter(
      ([, count]) => count > 10
    ).length,
    optimalBatchSizes: optimalBatchSizes.size
  })
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
    backend: backendState.isAvailable ? 'rust' : 'javascript',
    optimization: cache.stats()
  }
}

// Export deserializeData for use in workers
export {deserializeData}

// ============================================================================
// ERROR CLASSES (FUNCTIONAL)
// ============================================================================

export class ThreadValidationError extends Error {
  constructor(message: string, public functionString?: string) {
    super(message)
    this.name = 'ThreadValidationError'
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
