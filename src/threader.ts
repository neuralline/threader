// src/threader.ts
import {
  ThreadFunction,
  ThreadOptions,
  ThreadStatus,
  ThreadValidationError,
  ThreadCancelledError
} from './types'
import {validateFunction} from './utils/validation'
import {serializeFunction} from './utils/serialization'

/**
 * A unit of parallel work containing function and data
 */
export class Threader<T, R> {
  private _status: ThreadStatus = 'pending'
  private _result: R | undefined
  private _error: Error | undefined
  private _cancelled = false
  private _serializedFunction: string | undefined

  constructor(
    public readonly fn: ThreadFunction<T, R>,
    public readonly data: T,
    public readonly options: ThreadOptions = {}
  ) {
    // Validate function if validation is enabled (default true)
    if (this.options.validate !== false) {
      validateFunction(fn)
    }

    // Pre-serialize function for performance
    this._serializedFunction = serializeFunction(fn)
  }

  /**
   * Cancel this specific threader instance
   */
  async cancel(): Promise<void> {
    if (this._status === 'pending' || this._status === 'running') {
      this._cancelled = true
      this._status = 'cancelled'
      this._error = new ThreadCancelledError()
    }
  }

  /**
   * Get current execution status
   */
  get status(): ThreadStatus {
    return this._status
  }

  /**
   * Get execution result (available when status is 'completed')
   */
  get result(): R | undefined {
    return this._result
  }

  /**
   * Get error information (available when status is 'error')
   */
  get error(): Error | undefined {
    return this._error
  }

  /**
   * Check if this threader has been cancelled
   */
  get isCancelled(): boolean {
    return this._cancelled
  }

  /**
   * Get the serialized function string (for internal use)
   */
  get serializedFunction(): string {
    if (!this._serializedFunction) {
      this._serializedFunction = serializeFunction(this.fn)
    }
    return this._serializedFunction
  }

  /**
   * Set the execution status (internal use only)
   */
  _setStatus(status: ThreadStatus): void {
    this._status = status
  }

  /**
   * Set the execution result (internal use only)
   */
  _setResult(result: R): void {
    this._result = result
    this._status = 'completed'
  }

  /**
   * Set the execution error (internal use only)
   */
  _setError(error: Error): void {
    this._error = error
    this._status = 'error'
  }

  /**
   * Create a JSON representation for worker communication
   */
  toJSON() {
    return {
      function: this.serializedFunction,
      data: this.data,
      options: this.options,
      id: Math.random().toString(36).substring(2, 15)
    }
  }
}

/**
 * Factory function to create Threader instances
 */
export function threader<T, R>(
  fn: ThreadFunction<T, R>,
  data: T,
  options?: ThreadOptions
): Threader<T, R> {
  return new Threader(fn, data, options)
}
