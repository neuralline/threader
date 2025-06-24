// workers/multicore-worker.js
const {parentPort} = require('worker_threads')

if (!parentPort) {
  throw new Error('This script must be run as a worker thread')
}

// Listen for tasks from the main thread
parentPort.on('message', async message => {
  if (message.type !== 'EXECUTE') return

  const {taskId, functionString, data, timeout} = message

  try {
    // Execute function in worker context
    const result = await executeInWorker(functionString, data, timeout)

    parentPort.postMessage({
      taskId,
      result,
      error: null
    })
  } catch (error) {
    parentPort.postMessage({
      taskId,
      result: null,
      error: error.message
    })
  }
})

async function executeInWorker(functionString, data, timeout) {
  // Create function from string in isolated context
  const fn = new Function(
    'data',
    `
    // Worker execution context with access to safe modules
    const require = (id) => {
      // Allow specific safe modules
      const allowedModules = {
        'crypto': require('crypto'),
        'path': require('path'),
        'util': require('util'),
        'os': require('os'),
        'buffer': require('buffer'),
        // Add more safe modules as needed
      }
      if (allowedModules[id]) return allowedModules[id]
      throw new Error('Module not allowed in worker: ' + id)
    }

    // Execute the user function
    const userFn = ${functionString}
    return userFn(data)
  `
  )

  // Execute with timeout if specified
  if (timeout) {
    return Promise.race([
      Promise.resolve(fn(data)),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Worker timeout')), timeout)
      )
    ])
  }

  return fn(data)
}

// Handle graceful shutdown
parentPort.on('close', () => {
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

process.on('unhandledRejection', reason => {
  console.error('Unhandled rejection in worker:', reason)
  parentPort.postMessage({
    taskId: 'unknown',
    result: null,
    error: `Unhandled rejection: ${reason}`
  })
})
