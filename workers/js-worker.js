// workers/js-worker.js - Updated for enhanced threader system
/**
 * Enhanced JavaScript worker for threader system
 * Handles optimized function serialization and execution
 */

const {parentPort} = require('worker_threads')

if (!parentPort) {
  throw new Error('This script must be run as a worker thread')
}

// Worker state
let isShuttingDown = false
let executionCount = 0

// Enhanced message handling for optimized threader system
parentPort.on('message', async taskData => {
  // Handle shutdown signal
  if (taskData.type === 'SHUTDOWN') {
    isShuttingDown = true
    process.exit(0)
    return
  }

  const startTime = Date.now()
  executionCount++

  const {
    id,
    fnString,
    data,
    serializedData,
    optimizationHints,
    timeout = 30000
  } = taskData

  try {
    // Enhanced function deserialization
    const func = deserializeFunctionEnhanced(fnString)

    // Use optimized data if available
    const processedData = serializedData
      ? deserializeOptimizedData(serializedData)
      : typeof data === 'string'
      ? JSON.parse(data)
      : data

    // Apply execution timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Worker execution timeout')), timeout)
    )

    // Execute function with timeout protection
    const executionPromise = executeFunction(
      func,
      processedData,
      optimizationHints
    )

    const result = await Promise.race([executionPromise, timeoutPromise])

    // Send successful result
    parentPort.postMessage({
      success: true,
      taskId: id,
      result,
      duration: Date.now() - startTime,
      executionCount,
      workerId: process.pid,
      optimizationUsed: optimizationHints?.operationType || 'javascript'
    })
  } catch (error) {
    // Send error result
    parentPort.postMessage({
      success: false,
      taskId: id,
      error: error.message,
      duration: Date.now() - startTime,
      executionCount,
      workerId: process.pid
    })
  }
})

/**
 * Enhanced function deserialization that handles multiple formats
 */
function deserializeFunctionEnhanced(fnString) {
  try {
    // Remove any wrapping parentheses
    let cleanFunction = fnString.trim()
    if (cleanFunction.startsWith('(') && cleanFunction.endsWith(')')) {
      cleanFunction = cleanFunction.slice(1, -1)
    }

    // Handle different function formats
    if (cleanFunction.startsWith('function')) {
      // Regular function: function name() { ... }
      return new Function('return ' + cleanFunction)()
    } else if (cleanFunction.includes('=>')) {
      // Arrow function: () => { ... } or x => value
      return new Function('return ' + cleanFunction)()
    } else if (cleanFunction.startsWith('async')) {
      // Async function
      return new Function('return ' + cleanFunction)()
    } else {
      // Try wrapping as arrow function
      return new Function('return ' + cleanFunction)()
    }
  } catch (error) {
    // Fallback: try to create as arrow function
    try {
      return new Function('return (' + fnString + ')')()
    } catch (fallbackError) {
      throw new Error(
        `Failed to deserialize function: ${error.message}. Fallback also failed: ${fallbackError.message}`
      )
    }
  }
}

/**
 * Deserialize optimized data from binary protocol
 */
function deserializeOptimizedData(serializedData) {
  try {
    if (serializedData.format === 'binary') {
      // Handle binary data (would need msgpack in worker)
      // For now, fallback to JSON
      console.warn(
        'Binary deserialization not implemented in worker, using fallback'
      )
      return JSON.parse(serializedData.fallbackJson || '{}')
    } else if (serializedData.format === 'json') {
      return typeof serializedData.buffer === 'string'
        ? JSON.parse(serializedData.buffer)
        : serializedData.buffer
    } else {
      return serializedData
    }
  } catch (error) {
    console.warn(
      'Failed to deserialize optimized data, using raw data:',
      error.message
    )
    return serializedData
  }
}

/**
 * Execute function with optimization hints
 */
async function executeFunction(func, data, optimizationHints) {
  // Create optimized execution context
  const context = createOptimizedContext(optimizationHints)

  try {
    // Apply function in context with optimization hints
    const result = await func.call(context, data)
    return result
  } catch (error) {
    throw new Error(`Function execution failed: ${error.message}`)
  }
}

/**
 * Create execution context with optimization hints
 */
function createOptimizedContext(optimizationHints = {}) {
  const baseContext = {
    // Allow essential JavaScript objects
    Array,
    Object,
    String,
    Number,
    Boolean,
    Math,
    JSON,
    Date,
    RegExp,
    Error,

    // Allow common utilities
    parseInt,
    parseFloat,
    isNaN,
    isFinite,

    // Console for debugging (can be disabled in production)
    console: process.env.NODE_ENV === 'development' ? console : undefined,

    // Restricted globals (undefined to prevent access)
    setTimeout: undefined,
    setInterval: undefined,
    fetch: undefined,
    XMLHttpRequest: undefined,
    localStorage: undefined,
    sessionStorage: undefined,
    window: undefined,
    document: undefined,
    global: undefined,
    process: undefined,
    require: undefined,
    __dirname: undefined,
    __filename: undefined
  }

  // Apply optimization hints
  if (optimizationHints.operationType === 'mathematical') {
    // Enhanced Math object for mathematical operations
    baseContext.Math = {
      ...Math
      // Could add optimized math functions
    }
  }

  if (optimizationHints.isHotFunction) {
    // Mark context for hot function optimizations
    baseContext.__isHotFunction = true
  }

  return baseContext
}

/**
 * Handle worker shutdown gracefully
 */
parentPort.on('close', () => {
  if (!isShuttingDown) {
    console.log(
      `Worker ${process.pid} shutting down after ${executionCount} executions`
    )
  }
  process.exit(0)
})

// Handle uncaught errors
process.on('uncaughtException', error => {
  console.error('Uncaught exception in worker:', error)
  parentPort.postMessage({
    success: false,
    taskId: 'unknown',
    error: `Uncaught exception: ${error.message}`,
    workerId: process.pid
  })
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection in worker:', reason)
  parentPort.postMessage({
    success: false,
    taskId: 'unknown',
    error: `Unhandled rejection: ${reason}`,
    workerId: process.pid
  })
})

// Send ready signal
parentPort.postMessage({
  type: 'WORKER_READY',
  workerId: process.pid,
  timestamp: Date.now()
})
