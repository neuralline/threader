// src/utils/validation.ts
import {ThreadValidationError} from '../types'

/**
 * Patterns that indicate potential side effects
 */
const SIDE_EFFECT_PATTERNS = [
  // Console operations (allow in development mode)
  /console\./,

  // Network operations
  /fetch\(/,
  /XMLHttpRequest/,
  /axios\./,

  // Storage operations
  /localStorage/,
  /sessionStorage/,
  /indexedDB/,

  // DOM operations
  /document\./,
  /window\./,
  /navigator\./,

  // File system (Node.js)
  /require\(['"]fs['"]\)/,
  /import.*from.*['"]fs['"]/,

  // Timer functions (but allow Promise-based delays)
  /setInterval/,
  /setImmediate/,

  // Global variables (common ones)
  /global\./,
  /process\./,

  // Random functions (non-deterministic)
  /Math\.random/,
  /Date\.now/,
  /new Date\(/
]

/**
 * Patterns that are allowed even though they might look suspicious
 */
const ALLOWED_ASYNC_PATTERNS = [
  // Promise-based delays (common async pattern)
  /new Promise\(resolve\s*=>\s*setTimeout\(resolve/,
  // Promise.resolve with setTimeout
  /Promise\.resolve\(\)\.then\(\(\)\s*=>\s*new Promise\(resolve\s*=>\s*setTimeout/
]

/**
 * Allowed patterns that are safe for pure functions
 */
const ALLOWED_PATTERNS = [
  // Mathematical operations
  /Math\.(abs|ceil|floor|round|max|min|pow|sqrt|sin|cos|tan|log)/,

  // Array/String/Object methods
  /\.(map|filter|reduce|forEach|find|some|every|join|split|slice)/,

  // JSON operations
  /JSON\.(parse|stringify)/,

  // Type checking
  /typeof/,
  /instanceof/,
  /Array\.isArray/
]

/**
 * Validate that a function is pure and safe for parallel execution
 */
export function validateFunction<T, R>(fn: (data: T) => R | Promise<R>): void {
  const funcString = fn.toString()

  // Check if it's an allowed async pattern first
  const isAllowedAsync = ALLOWED_ASYNC_PATTERNS.some(pattern =>
    pattern.test(funcString)
  )

  // Check for obvious side effects (but be lenient in development)
  for (const pattern of SIDE_EFFECT_PATTERNS) {
    if (pattern.test(funcString)) {
      // Allow console.log in development mode
      if (
        pattern.source === 'console\\.' &&
        process.env.NODE_ENV === 'development'
      ) {
        console.warn(
          '⚠️ Console statements detected - will be stripped in worker execution'
        )
        continue
      }

      // Allow setTimeout if it's part of an allowed async pattern
      if (pattern.source.includes('setTimeout') && isAllowedAsync) {
        continue
      }

      throw new ThreadValidationError(
        `Potential side effect detected: ${pattern.source}. Use pure functions for parallel execution.`,
        funcString
      )
    }
  }

  // Additional checks for function structure
  validateFunctionStructure(funcString)

  // Check for closure variables (basic check)
  validateClosureScope(fn, funcString)
}

/**
 * Validate the basic structure of the function
 */
function validateFunctionStructure(funcString: string): void {
  // Check for arrow function or regular function
  const isArrowFunction = /^(\s*\([^)]*\)\s*=>)|(\s*\w+\s*=>)/.test(funcString)
  const isRegularFunction = /^function/.test(funcString)
  const isMethodFunction = /^\w+\s*\([^)]*\)\s*\{/.test(funcString)

  if (!isArrowFunction && !isRegularFunction && !isMethodFunction) {
    throw new ThreadValidationError(
      'Function must be a regular function, arrow function, or method',
      funcString
    )
  }

  // Check for async function (currently supported)
  const isAsync =
    /^async\s+/.test(funcString) || /^\s*async\s*\(/.test(funcString)

  // Async functions are allowed but we should note it
  if (isAsync) {
    // Just a note - async functions are supported
  }
}

/**
 * Basic validation of closure scope (limited check)
 */
function validateClosureScope<T, R>(
  fn: (data: T) => R | Promise<R>,
  funcString: string
): void {
  // This is a basic check - true closure detection is complex
  // We look for variables that might be from parent scope

  try {
    // Try to recreate the function to see if it throws
    // This catches obvious closure dependencies
    new Function('return ' + funcString)()
  } catch (error) {
    // If we can't recreate the function, it likely has closure dependencies
    console.warn('Function may have closure dependencies:', error.message)
    // For now, we just warn - in production we might want to be stricter
  }
}

/**
 * Check if a value is transferable (can be sent to worker without cloning)
 * Node.js compatible version
 */
export function isTransferable(value: any): boolean {
  if (value instanceof ArrayBuffer) return true
  if (value instanceof MessagePort) return true

  // Check for ImageBitmap only if it exists (browser only)
  if (typeof ImageBitmap !== 'undefined' && value instanceof ImageBitmap) {
    return true
  }

  // Check for SharedArrayBuffer if available
  if (
    typeof SharedArrayBuffer !== 'undefined' &&
    value instanceof SharedArrayBuffer
  ) {
    return true
  }

  // Node.js specific transferables
  if (typeof Buffer !== 'undefined' && value instanceof Buffer) {
    return false // Buffers are not transferable, but can be cloned efficiently
  }

  return false
}

/**
 * Get transferable objects from data (Node.js safe)
 */
export function getTransferables(data: any): any[] {
  const transferables: any[] = []

  function findTransferables(obj: any, visited = new Set()) {
    if (visited.has(obj)) return
    if (obj === null || typeof obj !== 'object') return

    visited.add(obj)

    if (isTransferable(obj)) {
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
  } catch (error) {
    // If transferable detection fails, return empty array
    console.warn('Transferable detection failed:', error.message)
    return []
  }

  return transferables
}

/**
 * Estimate the size of data for transfer optimization
 */
export function estimateDataSize(data: any): number {
  try {
    return Buffer.byteLength(JSON.stringify(data), 'utf8')
  } catch {
    // Fallback for non-serializable data
    return 1000 // Default estimate
  }
}

/**
 * Create a safe validation mode for development
 */
export function createLenientValidator() {
  const originalValidate = validateFunction

  return function lenientValidateFunction<T, R>(
    fn: (data: T) => R | Promise<R>
  ): void {
    try {
      originalValidate(fn)
    } catch (error) {
      if (error instanceof ThreadValidationError) {
        // In development, warn instead of throwing
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ Function validation warning:', error.message)
          return
        }
      }
      throw error
    }
  }
}
