// examples/rust-performance-demo.ts
import {threader, thread, benchmark} from '../src/threader'
import {performance} from 'perf_hooks'

async function demonstrateRustPerformance() {
  console.log('🦀 Rust Backend Performance Demonstration\n')

  // Check if Rust backend is available
  console.log('📊 System Info:', thread.stats())

  if (!thread.stats().rustAvailable) {
    console.error(
      '❌ Rust backend not available! Please build the Rust components first.'
    )
    console.log('Run: npm run build:rust')
    return
  }

  console.log('\n✅ Rust backend is available! Running performance tests...\n')

  // 1. Rust-optimized functions (should be blazing fast)
  console.log('🚀 Testing Rust-optimized patterns:')

  const rustOptimizedTests = [
    {name: 'Multiplication (x * 2)', fn: (x: number) => x * 2, data: 42},
    {name: 'Addition (x + 5)', fn: (x: number) => x + 5, data: 37},
    {
      name: 'String toLowerCase',
      fn: (x: string) => x.toLowerCase(),
      data: 'HELLO WORLD'
    },
    {
      name: 'String toUpperCase',
      fn: (x: string) => x.toUpperCase(),
      data: 'hello world'
    },
    {name: 'Square (x * x)', fn: (x: number) => x * x, data: 15}
  ]

  for (const test of rustOptimizedTests) {
    const result = benchmark(test.fn, test.data, 100000)
    console.log(`   ${test.name}:`)
    console.log(
      `      Direct JS: ${result.direct.opsPerSec.toFixed(0)} ops/sec`
    )
    console.log(`      Rust: ${result.rust.opsPerSec.toFixed(0)} ops/sec`)
    console.log(`      Speedup: ${result.speedup.toFixed(2)}x`)
    console.log(`      Strategy: ${result.strategy}`)
    console.log()
  }

  // 2. Parallel execution with Rust backend
  console.log('⚡ Testing parallel execution with Rust backend:')

  const parallelTasks = Array.from({length: 1000}, (_, i) =>
    threader((x: number) => x * 2, i)
  )

  const start = performance.now()
  const results = await thread.all(...parallelTasks)
  const duration = performance.now() - start

  console.log(
    `   Processed ${parallelTasks.length} tasks in ${duration.toFixed(2)}ms`
  )
  console.log(
    `   Throughput: ${((parallelTasks.length / duration) * 1000).toFixed(
      0
    )} tasks/second`
  )
  console.log(`   First 10 results: [${results.slice(0, 10).join(', ')}]`)
  console.log()

  // 3. Streaming results demonstration
  console.log('🌊 Testing streaming results:')

  const streamingTasks = Array.from({length: 100}, (_, i) =>
    threader((x: number) => x * x, i)
  )

  let streamCount = 0
  const streamStart = performance.now()

  for await (const {result, duration, strategy} of thread.stream(
    ...streamingTasks
  )) {
    streamCount++
    if (streamCount <= 5 || streamCount % 20 === 0) {
      console.log(
        `   Task ${streamCount}: result=${result}, duration=${duration.toFixed(
          4
        )}ms, strategy=${strategy}`
      )
    }
  }

  const streamTotal = performance.now() - streamStart
  console.log(
    `   Completed ${streamCount} streaming tasks in ${streamTotal.toFixed(2)}ms`
  )
  console.log()

  // 4. Mixed workload test
  console.log('🎯 Testing mixed workload (Rust + fallback):')

  const mixedTasks = [
    threader((x: number) => x * 2, 10), // Rust-optimized
    threader((x: number) => x + 5, 20), // Rust-optimized
    threader(
      (arr: number[]) => arr.reduce((a, b) => a + b, 0),
      [1, 2, 3, 4, 5]
    ), // Fallback
    threader((x: string) => x.toLowerCase(), 'MIXED'), // Rust-optimized
    threader((obj: any) => ({...obj, processed: true}), {id: 1}) // Fallback
  ]

  console.log('   Processing mixed workload...')
  for await (const {result, duration, strategy, index} of thread.stream(
    ...mixedTasks
  )) {
    console.log(
      `   Task ${index}: ${JSON.stringify(result)} (${duration.toFixed(
        4
      )}ms, ${strategy})`
    )
  }
  console.log()

  // 5. Race condition test
  console.log('🏁 Testing race execution:')

  const raceTasks = [
    threader((x: number) => x * 2, 100), // Fast Rust task
    threader((x: number) => x + 10, 200), // Fast Rust task
    threader((x: number) => x * x, 300) // Fast Rust task
  ]

  const winner = await thread.race(...raceTasks)
  console.log(
    `   Race winner: index=${winner.index}, result=${
      winner.result
    }, duration=${winner.duration.toFixed(4)}ms`
  )
  console.log()

  // 6. Performance comparison: Batch vs Individual
  console.log('📈 Comparing batch vs individual execution:')

  const batchTasks = Array.from({length: 500}, (_, i) =>
    threader((x: number) => x * 2, i)
  )

  // Batch execution (should use Rust's executeAll)
  const batchStart = performance.now()
  const batchResults = await thread.all(...batchTasks)
  const batchDuration = performance.now() - batchStart

  // Individual execution
  const individualStart = performance.now()
  const individualResults: number[] = []
  for (const task of batchTasks) {
    const result = task.fn(task.data) as number
    individualResults.push(result)
  }
  const individualDuration = performance.now() - individualStart

  console.log(`   Batch execution (Rust): ${batchDuration.toFixed(2)}ms`)
  console.log(
    `   Individual execution (JS): ${individualDuration.toFixed(2)}ms`
  )
  console.log(
    `   Batch speedup: ${(individualDuration / batchDuration).toFixed(
      2
    )}x faster`
  )
  console.log(
    `   Results match: ${
      JSON.stringify(batchResults.slice(0, 5)) ===
      JSON.stringify(individualResults.slice(0, 5))
    }`
  )
  console.log()

  console.log('🎉 Rust performance demonstration complete!')
  console.log('Key benefits demonstrated:')
  console.log('   ✅ Pattern-optimized Rust execution')
  console.log('   ✅ Batch processing for maximum throughput')
  console.log('   ✅ Seamless fallback for complex functions')
  console.log('   ✅ Multi-core utilization via Rust backend')
}

// Simple verification test
async function verifyRustIntegration() {
  console.log('🔍 Verifying Rust Integration...\n')

  try {
    // Test basic Rust functionality
    const simpleTask = threader((x: number) => x * 2, 21)
    const result = await thread.all(simpleTask)

    console.log(`✅ Basic test: threader(x => x * 2, 21) = ${result[0]}`)

    if (result[0] === 42) {
      console.log('✅ Rust integration working correctly!')
    } else {
      console.log('❌ Unexpected result - integration issue')
    }
  } catch (error) {
    console.error('❌ Rust integration failed:', error.message)
    console.log('\n💡 Troubleshooting steps:')
    console.log('   1. Run: npm run build:rust')
    console.log('   2. Check if .node file exists in project root')
    console.log('   3. Verify platform compatibility')
  }
}

async function runRustDemo() {
  await verifyRustIntegration()
  await demonstrateRustPerformance()
  await thread.shutdown()
}

runRustDemo().catch(console.error)
