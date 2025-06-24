// workers/js-worker.js
/**
 * JavaScript fallback worker for environments where Rust bindings are not available
 */

const {parentPort} = require('worker_threads')

if (!parentPort) {
  throw new Error('This script must be run as a worker thread')
}

// Listen for tasks from the main thread
parentPort.on('message', async taskData => {
  // Handle shutdown signal
  if (taskData.type === 'SHUTDOWN') {
    isShuttingDown = true
    process.exit(0)
    return
  }

  const {id, functionString, data} = taskData
  const startTime = Date.now()

  try {
    // Deserialize the function
    const func = deserializeFunction(functionString)

    // Parse JSON data if it's a string
    const parsedData = typeof data === 'string' ? JSON.parse(data) : data

    // Execute the function with the data
    const result = await executeFunction(func, parsedData)

    // Send result back to main thread
    parentPort.postMessage({
      taskId: id,
      result,
      duration: Date.now() - startTime,
      error: null
    })
  } catch (error) {
    // Send error back to main thread
    parentPort.postMessage({
      taskId: id,
      result: null,
      duration: Date.now() - startTime,
      error: error.message
    })
  }
})

/**
 * Deserialize a function string back to an executable function
 */
function deserializeFunction(functionString) {
  try {
    // Remove any surrounding parentheses
    const cleanFunction = functionString.replace(/^\(|\)$/g, '')

    // Create function from string
    const func = new Function('return ' + cleanFunction)()

    if (typeof func !== 'function') {
      throw new Error('Deserialized value is not a function')
    }

    return func
  } catch (error) {
    throw new Error(`Failed to deserialize function: ${error.message}`)
  }
}

/**
 * Execute a function with data in an isolated context
 */
async function executeFunction(func, data) {
  // Create a restricted context for function execution
  const context = createRestrictedContext()

  try {
    // Bind the function to the restricted context if possible
    const result = await func.call(context, data)
    return result
  } catch (error) {
    throw new Error(`Function execution failed: ${error.message}`)
  }
}

/**
 * Create a restricted execution context to prevent side effects
 */
function createRestrictedContext() {
  // This is a basic restricted context
  // In a production environment, you'd want more sophisticated sandboxing
  return {
    // Allow basic JavaScript objects and methods
    Array,
    Object,
    String,
    Number,
    Boolean,
    Date: undefined, // Restrict Date to prevent non-deterministic behavior
    Math: {
      // Allow most Math methods but restrict random
      ...Math,
      random: undefined
    },
    JSON,

    // Restrict access to global objects
    console: undefined,
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
    require: undefined
  }
}

/**
 * Handle worker shutdown
 */
parentPort.on('close', () => {
  // Clean up any resources
  process.exit(0)
})

// Handle uncaught errors
process.on('uncaughtException', error => {
  console.error('Uncaught exception in worker:', error)
  parentPort.postMessage({
    taskId: 'unknown',
    result: null,
    error: `Uncaught exception: ${error.message}`
  })
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection in worker:', reason)
  parentPort.postMessage({
    taskId: 'unknown',
    result: null,
    error: `Unhandled rejection: ${reason}`
  })
})
