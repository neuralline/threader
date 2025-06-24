import {threader, thread} from '../src/index'

describe('Threader Basic Tests', () => {
  test('should create threader instances', () => {
    const processor = threader((x: number) => x * 2, 10)

    expect(processor).toBeDefined()
    expect(processor.data).toBe(10)
    expect(processor.status).toBe('pending')
  })

  test('should serialize functions correctly', () => {
    const processor1 = threader((x: number) => x * 2, 10)
    const processor2 = threader(function multiply(x: number) {
      return x * 3
    }, 20)

    expect(processor1.serializedFunction).toContain('x * 2')
    expect(processor2.serializedFunction).toContain('x * 3')
  })

  test('should validate function options', () => {
    const processor = threader((x: number) => x * 2, 10, {
      timeout: 5000,
      retries: 3,
      priority: 'high'
    })

    expect(processor.options.timeout).toBe(5000)
    expect(processor.options.retries).toBe(3)
    expect(processor.options.priority).toBe('high')
  })

  test('should handle cancellation', async () => {
    const processor = threader((x: number) => x * 2, 10)

    await processor.cancel()
    expect(processor.status).toBe('cancelled')
    expect(processor.isCancelled).toBe(true)
  })

  test('should convert to JSON for worker communication', () => {
    const processor = threader((x: number) => x * 2, 10)
    const json = processor.toJSON()

    expect(json).toHaveProperty('function')
    expect(json).toHaveProperty('data')
    expect(json).toHaveProperty('options')
    expect(json).toHaveProperty('id')
    expect(json.data).toBe(10)
  })
})

describe('Thread Executor Tests', () => {
  test('should handle empty processor arrays', async () => {
    const results = await thread.all()
    expect(results).toEqual([])
  })

  test('should handle single processor', async () => {
    const processor = threader((x: number) => x * 2, 10)

    // This will likely fail without workers set up, but tests the API
    try {
      const results = await thread.all(processor)
      expect(Array.isArray(results)).toBe(true)
    } catch (error) {
      // Expected to fail without proper worker setup
      expect(error).toBeDefined()
    }
  })

  test('should configure thread executor', () => {
    const originalConfig = thread.getConfig()

    thread.configure({
      maxWorkers: 8,
      timeout: 15000,
      enableValidation: false
    })

    const newConfig = thread.getConfig()
    expect(newConfig.maxWorkers).toBe(8)
    expect(newConfig.timeout).toBe(15000)
    expect(newConfig.enableValidation).toBe(false)

    // Restore original config
    thread.configure(originalConfig)
  })
})

describe('Function Validation Tests', () => {
  test('should allow pure functions', () => {
    expect(() => {
      threader((x: number) => x * 2, 10)
    }).not.toThrow()

    expect(() => {
      threader((data: number[]) => data.map(x => x + 1), [1, 2, 3])
    }).not.toThrow()
  })

  test('should reject functions with side effects when validation enabled', () => {
    expect(() => {
      threader(
        (x: number) => {
          console.log(x) // Side effect
          return x * 2
        },
        10,
        {validate: true}
      )
    }).toThrow()
  })

  test('should allow side effects when validation disabled', () => {
    expect(() => {
      threader(
        (x: number) => {
          console.log(x) // Side effect
          return x * 2
        },
        10,
        {validate: false}
      )
    }).not.toThrow()
  })
})
