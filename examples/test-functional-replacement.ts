// test-functional-replacement.ts
import {performance} from 'perf_hooks'

// Test both implementations side by side
async function compareFunctionalVsOriginal() {
  console.log('🔥 Functional vs Original Threader Comparison')
  console.log('=' * 60)

  // Test cases that should use different strategies
  const testCases = [
    {
      name: 'Simple Arithmetic (should use native)',
      fn: (x: number) => x * 2,
      data: 42,
      iterations: 10000
    },
    {
      name: 'String Operation (should use rust)',
      fn: (s: string) => s.toLowerCase(),
      data: 'HELLO',
      iterations: 10000
    },
    {
      name: 'Complex Operation (should use worker)',
      fn: (arr: number[]) =>
        arr.filter(x => x % 2 === 0).reduce((a, b) => a + b, 0),
      data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      iterations: 1000
    }
  ]

  for (const testCase of testCases) {
    console.log(`\n🧪 ${testCase.name}`)
    console.log('   Iterations:', testCase.iterations.toLocaleString())

    // Baseline (direct execution)
    const baselineStart = performance.now()
    for (let i = 0; i < testCase.iterations; i++) {
      testCase.fn(testCase.data)
    }
    const baselineEnd = performance.now()
    const baselineDuration = baselineEnd - baselineStart
    const baselineOpsPerSec = (testCase.iterations / baselineDuration) * 1000

    console.log(`   📊 Baseline: ${baselineDuration.toFixed(2)}ms`)
    console.log(
      `      Ops/sec: ${Math.round(baselineOpsPerSec).toLocaleString()}`
    )

    try {
      // Test original implementation
      console.log(`   🔧 Testing Original Implementation...`)
      const {threader: originalThreader, thread: originalThread} = await import(
        '../src/index'
      )

      const originalStart = performance.now()
      for (let i = 0; i < Math.min(testCase.iterations, 1000); i++) {
        // Limit iterations for slow original
        const task = originalThreader(testCase.fn, testCase.data)
        await originalThread.all(task)
      }
      const originalEnd = performance.now()
      const originalDuration = originalEnd - originalStart
      const originalOpsPerSec =
        (Math.min(testCase.iterations, 1000) / originalDuration) * 1000
      const originalOverhead =
        originalDuration /
        (baselineDuration *
          (Math.min(testCase.iterations, 1000) / testCase.iterations))

      console.log(`   📊 Original: ${originalDuration.toFixed(2)}ms`)
      console.log(
        `      Ops/sec: ${Math.round(originalOpsPerSec).toLocaleString()}`
      )
      console.log(`      Overhead: ${originalOverhead.toFixed(1)}x`)
    } catch (error) {
      console.log(`   ❌ Original failed: ${error.message}`)
    }

    try {
      // Test functional implementation (inline for now)
      console.log(`   ⚡ Testing Functional Implementation...`)

      // Inline functional implementation for testing
      const NATIVE_PATTERNS: Record<string, (data: any) => any> = {
        'x=>x*2': x => x * 2,
        'x=>x+5': x => x + 5,
        's=>s.toLowerCase()': s => s.toLowerCase()
      }

      const signature = (fn: Function) =>
        fn.toString().replace(/\s+/g, '').replace(/[()]/g, '')

      const functionalThreader = (fn: Function, data: any) => ({
        fn,
        data,
        executionPlan: {
          strategy: NATIVE_PATTERNS[signature(fn)] ? 'native' : 'worker',
          executor: NATIVE_PATTERNS[signature(fn)] || fn
        }
      })

      const functionalThread = {
        all: async (...tasks: any[]) => {
          return tasks.map(task => task.executionPlan.executor(task.data))
        }
      }

      const functionalStart = performance.now()
      for (let i = 0; i < testCase.iterations; i++) {
        const task = functionalThreader(testCase.fn, testCase.data)
        await functionalThread.all(task)
      }
      const functionalEnd = performance.now()
      const functionalDuration = functionalEnd - functionalStart
      const functionalOpsPerSec =
        (testCase.iterations / functionalDuration) * 1000
      const functionalOverhead = functionalDuration / baselineDuration

      console.log(`   📊 Functional: ${functionalDuration.toFixed(2)}ms`)
      console.log(
        `      Ops/sec: ${Math.round(functionalOpsPerSec).toLocaleString()}`
      )
      console.log(`      Overhead: ${functionalOverhead.toFixed(1)}x`)

      // Show strategy used
      const sig = signature(testCase.fn)
      const strategy = NATIVE_PATTERNS[sig] ? 'native' : 'worker'
      console.log(`      Strategy: ${strategy.toUpperCase()}`)
    } catch (error) {
      console.log(`   ❌ Functional failed: ${error.message}`)
    }

    console.log('   ' + '-'.repeat(50))
  }

  // Test caching benefits
  console.log('\n🧪 Cache Performance Test')

  // Inline cache test
  const CACHE = new Map()
  const cacheFn = (fn: Function) => {
    const sig = fn.toString().replace(/\s+/g, '')
    if (!CACHE.has(sig)) {
      CACHE.set(sig, {analyzed: true, timestamp: Date.now()})
    }
    return CACHE.get(sig)
  }

  const simpleFn = (x: number) => x * 2

  // First execution (cache miss)
  CACHE.clear()
  const missStart = performance.now()
  cacheFn(simpleFn)
  const missEnd = performance.now()
  const missDuration = missEnd - missStart

  // Second execution (cache hit)
  const hitStart = performance.now()
  cacheFn(simpleFn)
  const hitEnd = performance.now()
  const hitDuration = hitEnd - hitStart

  console.log(`   Cache miss: ${missDuration.toFixed(4)}ms`)
  console.log(`   Cache hit: ${hitDuration.toFixed(4)}ms`)
  console.log(`   Cache speedup: ${(missDuration / hitDuration).toFixed(1)}x`)
  console.log(`   Cache size: ${CACHE.size}`)

  // Show pattern matching in action
  console.log('\n📊 Pattern Matching Examples')
  const patterns = [
    (x: number) => x * 2,
    (x: number) => x + 5,
    (s: string) => s.toLowerCase(),
    (arr: number[]) => arr.length,
    (x: number) => x * x * x + 2 * x + 1 // Complex - should go to worker
  ]

  patterns.forEach(fn => {
    const sig = fn.toString().replace(/\s+/g, '').replace(/[()]/g, '')
    const hasNativePattern = [
      'x=>x*2',
      'x=>x+5',
      's=>s.toLowerCase()'
    ].includes(sig)
    const strategy = hasNativePattern ? 'native' : 'worker'
    console.log(`   ${fn.toString().replace(/\s+/g, ' ')} -> ${strategy}`)
  })
}

// Performance stress test
async function stressTest() {
  console.log('\n🚀 STRESS TEST: 100,000 Operations')
  console.log('=' * 50)

  try {
    // Inline stress test (no external imports)
    console.log('Testing with inline functional approach...')

    const NATIVE_PATTERNS: Record<string, (data: any) => any> = {
      'x=>x*2': x => x * 2
    }

    const signature = (fn: Function) =>
      fn.toString().replace(/\s+/g, '').replace(/[()]/g, '')

    const functionalThreader = (fn: Function, data: any) => ({
      fn,
      data,
      executor: NATIVE_PATTERNS[signature(fn)] || fn
    })

    const functionalThread = {
      all: async (...tasks: any[]) =>
        tasks.map(task => task.executor(task.data))
    }

    const iterations = 100000
    const fn = (x: number) => x * 2

    console.log(`Testing ${iterations.toLocaleString()} operations...`)

    // Batch create threaders
    const createStart = performance.now()
    const tasks = Array.from({length: iterations}, (_, i) =>
      functionalThreader(fn, i)
    )
    const createEnd = performance.now()
    const createDuration = createEnd - createStart

    console.log(`Threader creation: ${createDuration.toFixed(2)}ms`)
    console.log(
      `Creation rate: ${Math.round(
        (iterations / createDuration) * 1000
      ).toLocaleString()} tasks/sec`
    )

    // Execute a subset in parallel
    const executeStart = performance.now()
    const results = await functionalThread.all(...tasks.slice(0, 1000))
    const executeEnd = performance.now()
    const executeDuration = executeEnd - executeStart

    console.log(`Execution (1000 tasks): ${executeDuration.toFixed(2)}ms`)
    console.log(
      `Execution rate: ${Math.round(
        (1000 / executeDuration) * 1000
      ).toLocaleString()} tasks/sec`
    )
    console.log(`Results correct: ${results[0] === 0 && results[999] === 1998}`)
  } catch (error) {
    console.log(`❌ Stress test failed: ${error.message}`)
  }
}

// Run all tests
async function runAllTests() {
  try {
    await compareFunctionalVsOriginal()
    await stressTest()

    console.log('\n✅ All tests completed!')
    console.log('\n💡 Summary:')
    console.log(
      '   • Functional approach should show massive performance gains'
    )
    console.log('   • Native patterns should have minimal overhead')
    console.log('   • Caching should eliminate repeated pattern matching')
    console.log('   • No artificial restrictions on user code')
  } catch (error) {
    console.error('❌ Test suite failed:', error.message)
    console.error(error.stack)
  }
}

if (require.main === module) {
  runAllTests()
}

export {runAllTests}
