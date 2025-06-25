// src/thread.ts - DEBUG VERSION with detailed logging
import {performance} from 'perf_hooks'
import type {Threader} from './threader'

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
// WORKER THREAD EXECUTION (DEBUG VERSION)
// ============================================================================

/**
 * Execute with actual worker threads - DEBUG VERSION with extensive logging
 */
const executeWithWorkerThread = async <R>(
  threader: Threader<any, R>
): Promise<R> => {
  return new Promise((resolve, reject) => {
    const {Worker} = require('worker_threads')

    // DEBUG: Log what we're sending to worker
    const functionString = threader.fn.toString()
    console.log('🔍 DEBUG: Function string length:', functionString.length)
    console.log(
      '🔍 DEBUG: Function string preview:',
      functionString.substring(0, 100) + '...'
    )
    console.log(
      '🔍 DEBUG: Function starts with:',
      functionString.substring(0, 20)
    )

    // DEBUG: Enhanced worker script with extensive logging
    const workerScript = `
      const { parentPort } = require('worker_threads')
      
      console.log('🔧 Worker: Script loaded')
      
      parentPort.on('message', async (message) => {
        console.log('🔧 Worker: Received message keys:', Object.keys(message))
        console.log('🔧 Worker: Message type:', typeof message)
        
        const { fnString, data, taskId } = message
        
        console.log('🔧 Worker: taskId:', taskId)
        console.log('🔧 Worker: fnString type:', typeof fnString)
        console.log('🔧 Worker: fnString length:', fnString ? fnString.length : 'undefined')
        console.log('🔧 Worker: fnString preview:', fnString ? fnString.substring(0, 50) : 'undefined')
        console.log('🔧 Worker: data type:', typeof data)
        
        try {
          if (!fnString) {
            throw new Error('fnString is undefined or empty')
          }
          
          // DEBUG: Try different approaches to create function
          let func;
          console.log('🔧 Worker: Attempting to create function...')
          
          try {
            // Method 1: Direct eval
            console.log('🔧 Worker: Trying direct eval...')
            func = eval('(' + fnString + ')')
            console.log('🔧 Worker: Direct eval success, type:', typeof func)
          } catch (evalError) {
            console.log('🔧 Worker: Direct eval failed:', evalError.message)
            
            try {
              // Method 2: Function constructor
              console.log('🔧 Worker: Trying Function constructor...')
              func = new Function('return (' + fnString + ')')()
              console.log('🔧 Worker: Function constructor success, type:', typeof func)
            } catch (constructorError) {
              console.log('🔧 Worker: Function constructor failed:', constructorError.message)
              
              try {
                // Method 3: Handle function keyword
                console.log('🔧 Worker: Trying function keyword handling...')
                if (fnString.trim().startsWith('function')) {
                  func = new Function('return ' + fnString)()
                } else {
                  func = new Function('return (' + fnString + ')')()
                }
                console.log('🔧 Worker: Function keyword handling success, type:', typeof func)
              } catch (keywordError) {
                console.log('🔧 Worker: Function keyword handling failed:', keywordError.message)
                throw new Error('All function creation methods failed: ' + evalError.message + ' | ' + constructorError.message + ' | ' + keywordError.message)
              }
            }
          }
          
          if (typeof func !== 'function') {
            throw new Error('Created value is not a function, got: ' + typeof func)
          }
          
          console.log('🔧 Worker: Function created successfully')
          
          // Parse data
          let parsedData = data
          if (typeof data === 'string') {
            try {
              parsedData = JSON.parse(data)
              console.log('🔧 Worker: Data parsed as JSON')
            } catch (parseError) {
              console.log('🔧 Worker: Using data as string, JSON parse failed:', parseError.message)
            }
          }
          
          console.log('🔧 Worker: About to execute function with data type:', typeof parsedData)
          
          // Execute function
          const result = await func(parsedData)
          
          console.log('🔧 Worker: Function executed successfully, result type:', typeof result)
          
          parentPort.postMessage({ 
            success: true, 
            result, 
            taskId,
            workerId: process.pid 
          })
        } catch (error) {
          console.log('🔧 Worker: Error occurred:', error.message)
          console.log('🔧 Worker: Error stack:', error.stack)
          
          parentPort.postMessage({ 
            success: false, 
            error: error.message, 
            errorStack: error.stack,
            taskId,
            workerId: process.pid 
          })
        }
      })
      
      parentPort.on('error', (error) => {
        console.log('🔧 Worker: parentPort error:', error)
      })
      
      process.on('uncaughtException', (error) => {
        console.log('🔧 Worker: Uncaught exception:', error.message)
        parentPort.postMessage({
          success: false,
          error: 'Uncaught exception: ' + error.message,
          taskId: 'unknown'
        })
      })
      
      console.log('🔧 Worker: Ready to receive messages')
    `

    const worker = new Worker(workerScript, {eval: true})
    const timeout = threader.options.timeout || 30000
    let isCompleted = false

    // Handle worker messages
    worker.on(
      'message',
      ({success, result, error, errorStack, taskId, workerId}) => {
        console.log('🔍 DEBUG: Received worker message - success:', success)

        if (isCompleted) return
        isCompleted = true

        worker.terminate()

        if (success) {
          console.log('🔍 DEBUG: Worker success, result type:', typeof result)
          resolve(result)
        } else {
          console.log('🔍 DEBUG: Worker error:', error)
          if (errorStack) {
            console.log('🔍 DEBUG: Worker error stack:', errorStack)
          }
          reject(
            new Error(
              `Worker execution failed: ${error}${
                errorStack ? ' | Stack: ' + errorStack : ''
              }`
            )
          )
        }
      }
    )

    // Handle worker errors
    worker.on('error', error => {
      console.log('🔍 DEBUG: Worker error event:', error.message)

      if (isCompleted) return
      isCompleted = true

      worker.terminate()
      reject(new Error(`Worker error: ${error.message}`))
    })

    // Prepare message
    const taskMessage = {
      fnString: functionString,
      data:
        threader.optimizationData?.serializedData?.format === 'json'
          ? threader.optimizationData.serializedData.buffer
          : JSON.stringify(threader.data),
      taskId: threader.id || `task_${Date.now()}`
    }

    console.log('🔍 DEBUG: Sending message to worker:')
    console.log('  - fnString length:', taskMessage.fnString.length)
    console.log('  - data type:', typeof taskMessage.data)
    console.log('  - taskId:', taskMessage.taskId)

    try {
      worker.postMessage(taskMessage)
      console.log('🔍 DEBUG: Message sent to worker successfully')
    } catch (postError) {
      console.log(
        '🔍 DEBUG: Failed to send message to worker:',
        postError.message
      )
      if (!isCompleted) {
        isCompleted = true
        worker.terminate()
        reject(
          new Error(`Failed to send message to worker: ${postError.message}`)
        )
      }
    }

    // Timeout handling
    setTimeout(() => {
      if (isCompleted) return
      isCompleted = true

      console.log('🔍 DEBUG: Worker timeout after', timeout, 'ms')
      worker.terminate()
      reject(new Error(`Worker timeout after ${timeout}ms`))
    }, timeout)
  })
}

// ============================================================================
// EXECUTION FUNCTIONS (SIMPLIFIED FOR DEBUGGING)
// ============================================================================

/**
 * Execute single threader - DEBUG VERSION
 */
const executeOptimized = async <R>(threader: Threader<any, R>): Promise<R> => {
  console.log('🔍 DEBUG: executeOptimized called for task:', threader.id)

  // For debugging, always use worker threads (skip Rust)
  console.log('🔍 DEBUG: Using worker thread execution')
  return executeWithWorkerThread(threader)
}

/**
 * Execute all optimally - DEBUG VERSION
 */
const executeOptimally = async <R>(
  threaders: Threader<any, R>[]
): Promise<R[]> => {
  console.log(
    '🔍 DEBUG: executeOptimally called with',
    threaders.length,
    'threaders'
  )

  if (threaders.length === 0) return []

  // For debugging, execute in parallel with Promise.all
  const promises = threaders.map((t, index) => {
    console.log(`🔍 DEBUG: Creating promise ${index} for task:`, t.id)
    return executeOptimized(t)
  })

  console.log(
    '🔍 DEBUG: Executing',
    promises.length,
    'promises with Promise.all'
  )
  return Promise.all(promises)
}

// ============================================================================
// MAIN THREAD API (DEBUG VERSION)
// ============================================================================

export const thread = {
  /**
   * Execute all threaders - DEBUG VERSION
   */
  async all<T extends readonly Threader<any, any>[]>(
    ...processors: T
  ): Promise<ThreadResults<T>> {
    console.log(
      '🔍 DEBUG: thread.all called with',
      processors.length,
      'processors'
    )

    if (processors.length === 0) {
      console.log('🔍 DEBUG: No processors, returning empty array')
      return [] as any
    }

    const startTime = performance.now()

    try {
      console.log('🔍 DEBUG: About to call executeOptimally')
      const results = await executeOptimally(processors)

      const duration = performance.now() - startTime
      console.log('🔍 DEBUG: executeOptimally completed in', duration, 'ms')
      console.log('🔍 DEBUG: Results length:', results.length)

      return results as ThreadResults<T>
    } catch (error) {
      console.log('🔍 DEBUG: thread.all error:', error.message)
      throw new Error(`Thread.all execution failed: ${error.message}`)
    }
  },

  /**
   * Stream results - DEBUG VERSION
   */
  async *stream<T extends readonly Threader<any, any>[]>(
    ...processors: T
  ): AsyncIterable<ThreadResult<any>> {
    console.log(
      '🔍 DEBUG: thread.stream called with',
      processors.length,
      'processors'
    )

    if (processors.length === 0) return

    // Simple implementation for debugging
    for (let i = 0; i < processors.length; i++) {
      const processor = processors[i]
      const startTime = performance.now()

      try {
        console.log(`🔍 DEBUG: Streaming processor ${i}`)
        const result = await executeOptimized(processor)
        yield {
          index: i,
          result,
          duration: performance.now() - startTime
        }
      } catch (error) {
        console.log(`🔍 DEBUG: Stream processor ${i} failed:`, error.message)
        yield {
          index: i,
          result: undefined,
          error: error as Error,
          duration: performance.now() - startTime
        }
      }
    }
  },

  // Other methods (simplified for debugging)
  fire: () => console.log('🔍 DEBUG: fire called'),
  race: () => Promise.resolve({index: 0, result: null, duration: 0}),
  any: () => Promise.resolve([]),
  configure: (config: any) => console.log('🔍 DEBUG: configure called', config),
  shutdown: async () => console.log('🔍 DEBUG: shutdown called'),
  getOptimizationStats: () => ({debug: 'stats'})
}

// Export for compatibility
export {executeOptimized, executeOptimally}
