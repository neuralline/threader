// src/utils/serialization.ts

import {Transferable} from 'worker_threads'

/**
 * Serialize a function to a string that can be sent to a worker thread
 */
export function serializeFunction<T, R>(
  fn: (data: T) => R | Promise<R>
): string {
  const funcString = fn.toString()

  // Handle different function types
  if (funcString.startsWith('function')) {
    // Regular function: function name() { ... }
    return funcString
  } else if (funcString.includes('=>')) {
    // Arrow function: () => { ... } or () => value
    return `(${funcString})`
  } else {
    // Method or other format
    return `function ${funcString}`
  }
}

/**
 * Deserialize a function string back to an executable function
 */
export function deserializeFunction<T, R>(
  funcString: string
): (data: T) => R | Promise<R> {
  try {
    // Create function from string
    const func = new Function('return ' + funcString)()

    if (typeof func !== 'function') {
      throw new Error('Deserialized value is not a function')
    }

    return func
  } catch (error) {
    throw new Error(`Failed to deserialize function: ${error.message}`)
  }
}

/**
 * Create a safe data clone that can be transferred to workers
 */
export function cloneData(data: any): any {
  // Use structured cloning algorithm (available in Node.js 17+)
  if (typeof structuredClone !== 'undefined') {
    try {
      return structuredClone(data)
    } catch (error) {
      console.warn(
        'structuredClone failed, falling back to JSON:',
        error.message
      )
    }
  }

  // Fallback to JSON serialization
  try {
    return JSON.parse(JSON.stringify(data))
  } catch (error) {
    throw new Error(`Cannot clone data: ${error.message}`)
  }
}

/**
 * Prepare function and data for worker execution
 */
export interface SerializedTask {
  id: string
  functionString: string
  data: string // Changed to string for consistent JSON serialization
  transferables?: Transferable[]
}

export function serializeTask<T, R>(
  fn: (data: T) => R | Promise<R>,
  data: T,
  id?: string
): SerializedTask {
  return {
    id: id || generateTaskId(),
    functionString: serializeFunction(fn),
    data: JSON.stringify(data) // Always serialize data as JSON string
  }
}

/**
 * Generate a unique task ID
 */
export function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}

/**
 * Prepare data with transferable objects for optimal performance
 */
export function prepareTransferableData(data: any): {
  data: any
  transferables: Transferable[]
} {
  const transferables: Transferable[] = []

  // Deep clone data and extract transferables
  const clonedData = cloneDataWithTransferables(data, transferables)

  return {data: clonedData, transferables}
}

/**
 * Clone data while identifying transferable objects
 */
function cloneDataWithTransferables(
  obj: any,
  transferables: Transferable[],
  visited = new Set()
): any {
  if (visited.has(obj)) {
    return obj // Circular reference handling
  }

  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  visited.add(obj)

  // Check if object is transferable
  if (
    obj instanceof ArrayBuffer ||
    obj instanceof MessagePort ||
    obj instanceof ImageBitmap
  ) {
    transferables.push(obj)
    return obj // Don't clone transferable objects
  }

  if (Array.isArray(obj)) {
    return obj.map(item =>
      cloneDataWithTransferables(item, transferables, visited)
    )
  }

  const cloned: any = {}
  for (const [key, value] of Object.entries(obj)) {
    cloned[key] = cloneDataWithTransferables(value, transferables, visited)
  }

  return cloned
}
