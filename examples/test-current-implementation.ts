// examples/test-current-implementation.ts - Test what's actually in your src/ files now

import {performance} from 'perf_hooks'

async function testCurrentImplementation() {
  console.log('🔍 Testing Your Current Implementation')
  console.log('=' * 50)

  try {
    // Import your current threader
    const {threader, thread} = await import('../src/index')

    console.log('\n📦 Threader imported successfully')
    console.log('   threader type:', typeof threader)
    console.log('   thread type:', typeof thread)

    // Test 1: Simple function creation
    console.log('\n🧪 Test 1: Creating a simple threader')
    const simpleTask = threader((x: number) => x * 2, 42)
    console.log('   ✅ Threader creation successful')
    console.log('   Task properties:', Object.keys(simpleTask))

    // Check if it has executionPlan (functional version)
    if ('executionPlan' in simpleTask) {
      console.log('   🚀 FUNCTIONAL VERSION DETECTED!')
      console.log('   Strategy:', (simpleTask as any).executionPlan?.strategy)
      console.log('   Signature:', (simpleTask as any).executionPlan?.signature)
    } else {
      console.log('   🔧 Original version detected')
    }

    // Test 2: Performance test
    console.log('\n⚡ Test 2: Performance test (1000 operations)')
    const iterations = 1000
    const fn = (x: number) => x * 2

    const start = performance.now()
    for (let i = 0; i < iterations; i++) {
      const task = threader(fn, i)
      await thread.all(task)
    }
    const end = performance.now()

    const duration = end - start
    const opsPerSec = (iterations / duration) * 1000

    console.log(`   Duration: ${duration.toFixed(2)}ms`)
    console.log(`   Ops/sec: ${Math.round(opsPerSec).toLocaleString()}`)
    console.log(
      `   Avg latency: ${(duration / iterations).toFixed(2)}ms per task`
    )

    // Performance classification
    if (opsPerSec > 100000) {
      console.log('   🚀 EXCELLENT PERFORMANCE (Functional implementation)')
    } else if (opsPerSec > 50000) {
      console.log('   ✅ Good performance (Optimized implementation)')
    } else if (opsPerSec > 10000) {
      console.log('   ⚠️  Moderate performance (Needs optimization)')
    } else {
      console.log('   ❌ Poor performance (Original slow implementation)')
    }

    // Test 3: Check for cache/pattern matching
    console.log('\n🧪 Test 3: Pattern matching test')

    // Create multiple tasks with same function
    const task1 = threader(fn, 1)
    const task2 = threader(fn, 2)

    if ('executionPlan' in task1 && 'executionPlan' in task2) {
      const plan1 = (task1 as any).executionPlan
      const plan2 = (task2 as any).executionPlan

      if (plan1 === plan2) {
        console.log('   ✅ Execution plans are cached (shared reference)')
      } else if (
        plan1.strategy === plan2.strategy &&
        plan1.signature === plan2.signature
      ) {
        console.log('   ✅ Execution plans match (same strategy and signature)')
      } else {
        console.log('   ⚠️  Execution plans differ')
      }

      console.log(`   Strategy: ${plan1.strategy}`)
      console.log(`   Signature: ${plan1.signature}`)
    }

    // Test 4: Different function types
    console.log('\n🧪 Test 4: Testing different function patterns')

    const testFunctions = [
      {name: 'Simple Math', fn: (x: number) => x * 2, data: 42},
      {name: 'String Op', fn: (s: string) => s.toLowerCase(), data: 'HELLO'},
      {name: 'Array Length', fn: (arr: any[]) => arr.length, data: [1, 2, 3]},
      {name: 'Complex', fn: (x: number) => Math.sqrt(x * x + 1), data: 25}
    ]

    for (const test of testFunctions) {
      const task = threader(test.fn, test.data)
      const result = await thread.all(task)

      let strategy = 'unknown'
      if ('executionPlan' in task) {
        strategy = (task as any).executionPlan.strategy
      }

      console.log(`   ${test.name}: ${JSON.stringify(result)} (${strategy})`)
    }

    // Test 5: Check available methods
    console.log('\n🧪 Test 5: Available thread methods')
    const threadMethods = Object.keys(thread)
    console.log('   Thread methods:', threadMethods)

    // Check if cache is available (functional version)
    try {
      const {cache} = await import('../src/index')
      if (cache) {
        console.log('   🚀 Cache utilities available!')
        console.log('   Cache size:', cache.size())
        console.log('   Cache stats:', cache.stats?.())
      }
    } catch {
      console.log('   📦 No cache utilities (not functional version)')
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.error(
      '   This might indicate import issues or broken implementation'
    )
  }
}

// Also test if benchmarking is available
async function testBenchmarkAvailability() {
  console.log('\n🧪 Test 6: Benchmark availability')

  try {
    const {benchmark} = await import('../src/index')
    if (benchmark) {
      console.log('   🚀 Benchmark function available!')

      // Run a quick benchmark
      const result = benchmark((x: number) => x * 2, 42, 1000)
      console.log('   Benchmark result:', result)
    }
  } catch {
    console.log('   📦 No benchmark function available')
  }
}

async function runCurrentTest() {
  console.log('🔍 TESTING YOUR CURRENT THREADER IMPLEMENTATION')
  console.log('This will tell us what you actually have in src/')
  console.log('=' * 70)

  await testCurrentImplementation()
  await testBenchmarkAvailability()

  console.log('\n📋 SUMMARY:')
  console.log('   This test reveals what implementation you currently have')
  console.log('   Look for "FUNCTIONAL VERSION DETECTED" vs "Original version"')
  console.log('   Performance should be >50K ops/sec if functional')
}

if (require.main === module) {
  runCurrentTest()
}

export {runCurrentTest}
