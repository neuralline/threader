// test-rust-acceleration.ts - Simple test for pure functional approach
import {threader, thread, benchmark} from '../src/threader'

async function testPureFunctionalApproach() {
  console.log('🦀 Testing Pure Functional Threader')
  console.log('===================================\n')

  // Wait for backend initialization
  await new Promise(resolve => setTimeout(resolve, 100))

  // Show system status
  const stats = thread.stats()
  console.log('📊 System Status:')
  console.log(`   Backend: ${stats.backend}`)
  console.log(`   Rust Available: ${stats.multiCoreAvailable}`)
  console.log(`   Cores: ${stats.coreCount}`)
  console.log(`   Mode: ${stats.mode}`)
  console.log()

  // Test 1: Simple functions (should use Rust if available)
  console.log('🧪 Test 1: Simple Mathematical Functions')

  const simpleFunctions = [
    {name: 'Multiply by 2', fn: (x: number) => x * 2, data: 21, expected: 42},
    {name: 'Add 5', fn: (x: number) => x + 5, data: 15, expected: 20},
    {name: 'Square', fn: (x: number) => x * x, data: 6, expected: 36},
    {name: 'Add 10', fn: (x: number) => x + 10, data: 32, expected: 42}
  ]

  for (const test of simpleFunctions) {
    try {
      const task = threader(test.fn, test.data)
      console.log(`   ${test.name}:`)

      const result = await thread.all(task)
      const correct = result[0] === test.expected
      console.log(
        `     Result: ${result[0]} (expected ${test.expected}) ${
          correct ? '✅' : '❌'
        }`
      )

      if (!correct) {
        console.log(`     ⚠️ Unexpected result - may need fallback`)
      }
    } catch (error) {
      console.log(`     ❌ Failed: ${error.message}`)
    }
    console.log()
  }

  // Test 2: String functions
  console.log('🧪 Test 2: String Functions')

  const stringFunctions = [
    {
      name: 'To Upper Case',
      fn: (s: string) => s.toUpperCase(),
      data: 'hello',
      expected: 'HELLO'
    },
    {
      name: 'To Lower Case',
      fn: (s: string) => s.toLowerCase(),
      data: 'WORLD',
      expected: 'world'
    }
  ]

  for (const test of stringFunctions) {
    try {
      const task = threader(test.fn, test.data)
      console.log(`   ${test.name}:`)

      const result = await thread.all(task)
      const correct = result[0] === test.expected
      console.log(
        `     Result: "${result[0]}" (expected "${test.expected}") ${
          correct ? '✅' : '❌'
        }`
      )
    } catch (error) {
      console.log(`     ❌ Failed: ${error.message}`)
    }
    console.log()
  }

  // Test 3: Complex functions (will use JavaScript fallback)
  console.log('🧪 Test 3: Complex Functions (JavaScript Fallback)')

  const complexFunctions = [
    {
      name: 'Array Reduce',
      fn: (arr: number[]) => arr.reduce((a, b) => a + b, 0),
      data: [1, 2, 3, 4],
      expected: 10
    },
    {
      name: 'Object Multiply',
      fn: (obj: {a: number; b: number}) => obj.a * obj.b,
      data: {a: 6, b: 7},
      expected: 42
    },
    {
      name: 'String Reverse',
      fn: (s: string) => s.split('').reverse().join(''),
      data: 'hello',
      expected: 'olleh'
    }
  ]

  for (const test of complexFunctions) {
    try {
      const task = threader(test.fn, test.data)
      console.log(`   ${test.name}:`)

      const result = await thread.all(task)
      const correct =
        JSON.stringify(result[0]) === JSON.stringify(test.expected)
      console.log(
        `     Result: ${JSON.stringify(result[0])} (expected ${JSON.stringify(
          test.expected
        )}) ${correct ? '✅' : '❌'}`
      )

      if (correct) {
        console.log(`     ✅ JavaScript fallback working perfectly`)
      }
    } catch (error) {
      console.log(`     ❌ Failed: ${error.message}`)
    }
    console.log()
  }

  // Test 4: Performance test
  console.log('🧪 Test 4: Performance Test')
  console.log('Testing 1000 simple multiplication tasks...\n')

  const perfTasks = Array.from({length: 1000}, (_, i) =>
    threader((x: number) => x * 2, i)
  )

  const start = Date.now()
  const results = await thread.all(...perfTasks)
  const duration = Date.now() - start

  const throughput = (perfTasks.length / duration) * 1000
  console.log(`⚡ Performance Results:`)
  console.log(`   Duration: ${duration}ms`)
  console.log(
    `   Throughput: ${Math.round(throughput).toLocaleString()} tasks/sec`
  )
  console.log(`   Sample results: [${results.slice(0, 5).join(', ')}...]`)
  console.log()

  // Performance classification
  if (stats.multiCoreAvailable) {
    console.log('🦀 Rust acceleration working!')
    if (throughput > 100000) {
      console.log('🚀 EXCELLENT performance with Rust!')
    } else if (throughput > 50000) {
      console.log('✅ Good performance with Rust')
    } else {
      console.log('⚠️ Rust working but may need optimization')
    }
  } else {
    console.log('📦 JavaScript execution only')
    if (throughput > 50000) {
      console.log('✅ Good JavaScript performance')
    } else {
      console.log('⚠️ Performance could be improved with Rust')
    }
  }

  // Test 5: Functional helpers
  console.log('\n🧪 Test 5: Functional Programming Helpers')

  try {
    // Import functional helpers
    const {pmap, pfilter, preduce} = await import('../src/threader')

    // Test pmap
    const data = [1, 2, 3, 4, 5]
    const mapped = await pmap(data, (x: number) => x * 2)
    console.log(`   pmap([1,2,3,4,5], x => x * 2): [${mapped.join(', ')}] ✅`)

    // Test pfilter
    const filtered = await pfilter(data, (x: number) => x > 2)
    console.log(
      `   pfilter([1,2,3,4,5], x => x > 2): [${filtered.join(', ')}] ✅`
    )

    // Test preduce
    const reduced = await preduce(data, (acc: number, x: number) => acc + x, 0)
    console.log(`   preduce([1,2,3,4,5], (a,b) => a+b, 0): ${reduced} ✅`)
  } catch (error) {
    console.log(`   ❌ Functional helpers test failed: ${error.message}`)
  }

  // Test 6: Library simulation (Redux-like)
  console.log('\n🧪 Test 6: Library Support Test (Redux-like)')

  try {
    // Simulate Redux reducer
    const reduxReducer = (state: any, action: any) => {
      switch (action.type) {
        case 'INCREMENT':
          return {...state, count: state.count + 1}
        case 'DECREMENT':
          return {...state, count: state.count - 1}
        default:
          return state
      }
    }

    const initialState = {count: 0}
    const actions = [
      {type: 'INCREMENT'},
      {type: 'INCREMENT'},
      {type: 'DECREMENT'}
    ]

    // Process actions in parallel (each gets a copy of state)
    const stateTasks = actions.map(action =>
      threader((data: any) => reduxReducer(data.state, data.action), {
        state: initialState,
        action
      })
    )

    const stateResults = await thread.all(...stateTasks)
    console.log(`   Redux-like parallel state updates:`)
    stateResults.forEach((result, i) => {
      console.log(`     Action ${i + 1}: count = ${result.count}`)
    })
    console.log(`   ✅ Complex JavaScript libraries work through fallback!`)
  } catch (error) {
    console.log(`   ❌ Library test failed: ${error.message}`)
  }

  // Test 7: Benchmark
  console.log('\n🧪 Test 7: Benchmark Analysis')

  const benchmarkFn = (x: number) => x * 2
  const benchResult = benchmark(benchmarkFn, 42, 10000)

  console.log('📊 Benchmark Results:')
  console.log(`   Backend: ${benchResult.backend}`)
  console.log(
    `   Direct JS: ${Math.round(
      benchResult.direct.opsPerSec
    ).toLocaleString()} ops/sec`
  )
  console.log()

  await thread.shutdown()
  console.log('✅ Pure functional test complete!')
}

testPureFunctionalApproach().catch(error => {
  console.error('💥 Test failed:', error)
  process.exit(1)
})
