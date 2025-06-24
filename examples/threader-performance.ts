// examples/threader-performance.ts
import {performance} from 'perf_hooks'
import {threader} from '../src/index'
import {thread} from '../src/index'
import type {BenchmarkResult} from './baseline'

interface ThreaderTestResult extends BenchmarkResult {
  backendUsed: 'rust' | 'javascript' | 'mixed'
  tasksPerSecond: number
  overhead: number // vs baseline computation
}

/**
 * Test Threader performance vs baseline
 */
async function testThreaderPerformance(): Promise<ThreaderTestResult[]> {
  const results: ThreaderTestResult[] = []

  // Test 1: Simple arithmetic (should use Rust backend)
  console.log('\n🧪 Testing Simple Arithmetic (x * 2)...')
  const arithBaseline = await measureBaseline(() => 42 * 2, 1000)
  const arithThreader = await measureThreader((x: number) => x * 2, 42, 1000)

  results.push({
    ...arithThreader,
    testName: 'Threader: Arithmetic (x * 2)',
    backendUsed: 'rust', // Should use Rust for this pattern
    overhead: arithThreader.avgLatencyMs / arithBaseline.avgLatencyMs
  })

  // Test 2: String operations (should use Rust backend)
  console.log('\n🧪 Testing String toLowerCase...')
  const stringBaseline = await measureBaseline(
    () => 'HELLO'.toLowerCase(),
    1000
  )
  const stringThreader = await measureThreader(
    (s: string) => s.toLowerCase(),
    'HELLO',
    1000
  )

  results.push({
    ...stringThreader,
    testName: 'Threader: String toLowerCase',
    backendUsed: 'rust',
    overhead: stringThreader.avgLatencyMs / stringBaseline.avgLatencyMs
  })

  // Test 3: Complex operation (should use JS worker)
  console.log('\n🧪 Testing Complex Array Operation...')
  const complexData = Array.from({length: 100}, (_, i) => i)
  const complexBaseline = await measureBaseline(
    () =>
      complexData
        .filter(x => x % 2 === 0)
        .map(x => x * x)
        .reduce((a, b) => a + b, 0),
    500
  )
  const complexThreader = await measureThreader(
    (arr: number[]) =>
      arr
        .filter(x => x % 2 === 0)
        .map(x => x * x)
        .reduce((a, b) => a + b, 0),
    complexData,
    500
  )

  results.push({
    ...complexThreader,
    testName: 'Threader: Complex Array Operation',
    backendUsed: 'javascript',
    overhead: complexThreader.avgLatencyMs / complexBaseline.avgLatencyMs
  })

  // Test 4: Parallel execution (multiple tasks)
  console.log('\n🧪 Testing Parallel Execution...')
  const parallelResult = await measureParallelExecution()
  results.push(parallelResult)

  // Test 5: Large data transfer
  console.log('\n🧪 Testing Large Data Transfer...')
  const largeData = Array.from({length: 10000}, (_, i) => ({
    id: i,
    value: Math.random()
  }))
  const largeDataBaseline = await measureBaseline(
    () => largeData.filter(x => x.value > 0.5).length,
    100
  )
  const largeDataThreader = await measureThreader(
    (data: Array<{id: number; value: number}>) =>
      data.filter(x => x.value > 0.5).length,
    largeData,
    100
  )

  results.push({
    ...largeDataThreader,
    testName: 'Threader: Large Data Transfer',
    backendUsed: 'javascript',
    overhead: largeDataThreader.avgLatencyMs / largeDataBaseline.avgLatencyMs
  })

  return results
}

/**
 * Measure baseline performance (direct function execution)
 */
async function measureBaseline(
  operation: () => any,
  iterations: number
): Promise<BenchmarkResult> {
  const latencies: number[] = []

  // Warmup
  for (let i = 0; i < Math.min(100, iterations / 10); i++) {
    operation()
  }

  const startTime = performance.now()

  for (let i = 0; i < iterations; i++) {
    const opStart = performance.now()
    operation()
    const opEnd = performance.now()
    latencies.push(opEnd - opStart)
  }

  const endTime = performance.now()
  const totalTimeMs = endTime - startTime

  latencies.sort((a, b) => a - b)

  return {
    testName: 'Baseline',
    totalOperations: iterations,
    totalTimeMs,
    opsPerSecond: (iterations / totalTimeMs) * 1000,
    avgLatencyMs:
      latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length,
    minLatencyMs: latencies[0],
    maxLatencyMs: latencies[latencies.length - 1],
    p95LatencyMs: calculatePercentile(latencies, 95),
    p99LatencyMs: calculatePercentile(latencies, 99)
  }
}

/**
 * Measure Threader performance
 */
async function measureThreader<T, R>(
  fn: (data: T) => R,
  data: T,
  iterations: number
): Promise<ThreaderTestResult> {
  const latencies: number[] = []

  // Warmup
  for (let i = 0; i < Math.min(10, iterations / 10); i++) {
    try {
      await thread.all(threader(fn, data))
    } catch (error) {
      console.warn('Warmup iteration failed:', error.message)
    }
  }

  const startTime = performance.now()

  for (let i = 0; i < iterations; i++) {
    const opStart = performance.now()
    try {
      await thread.all(threader(fn, data))
      const opEnd = performance.now()
      latencies.push(opEnd - opStart)
    } catch (error) {
      console.error(`Iteration ${i} failed:`, error.message)
      // Add a penalty for failed operations
      latencies.push(1000) // 1 second penalty
    }
  }

  const endTime = performance.now()
  const totalTimeMs = endTime - startTime

  latencies.sort((a, b) => a - b)

  const successfulOps = latencies.filter(lat => lat < 1000).length
  const avgLatency =
    latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length

  return {
    testName: 'Threader',
    totalOperations: iterations,
    totalTimeMs,
    opsPerSecond: (successfulOps / totalTimeMs) * 1000,
    tasksPerSecond: (successfulOps / totalTimeMs) * 1000,
    avgLatencyMs: avgLatency,
    minLatencyMs: latencies[0],
    maxLatencyMs: latencies[latencies.length - 1],
    p95LatencyMs: calculatePercentile(latencies, 95),
    p99LatencyMs: calculatePercentile(latencies, 99),
    backendUsed: 'mixed',
    overhead: 0 // Will be calculated externally
  }
}

/**
 * Test parallel execution performance
 */
async function measureParallelExecution(): Promise<ThreaderTestResult> {
  const parallelTasks = [
    threader((x: number) => x * 2, 10),
    threader((x: number) => x * 3, 20),
    threader((x: number) => x * 4, 30),
    threader((x: number) => x * 5, 40)
  ]

  const iterations = 100
  const latencies: number[] = []

  // Warmup
  for (let i = 0; i < 5; i++) {
    try {
      await thread.all(...parallelTasks)
    } catch (error) {
      console.warn('Parallel warmup failed:', error.message)
    }
  }

  const startTime = performance.now()

  for (let i = 0; i < iterations; i++) {
    const opStart = performance.now()
    try {
      await thread.all(...parallelTasks)
      const opEnd = performance.now()
      latencies.push(opEnd - opStart)
    } catch (error) {
      console.error(`Parallel iteration ${i} failed:`, error.message)
      latencies.push(1000) // Penalty
    }
  }

  const endTime = performance.now()
  const totalTimeMs = endTime - startTime

  latencies.sort((a, b) => a - b)
  const successfulOps = latencies.filter(lat => lat < 1000).length

  return {
    testName: 'Threader: Parallel Execution (4 tasks)',
    totalOperations: iterations,
    totalTimeMs,
    opsPerSecond: (successfulOps / totalTimeMs) * 1000,
    tasksPerSecond: ((successfulOps * 4) / totalTimeMs) * 1000, // 4 tasks per operation
    avgLatencyMs:
      latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length,
    minLatencyMs: latencies[0],
    maxLatencyMs: latencies[latencies.length - 1],
    p95LatencyMs: calculatePercentile(latencies, 95),
    p99LatencyMs: calculatePercentile(latencies, 99),
    backendUsed: 'rust',
    overhead: 0
  }
}

/**
 * Calculate percentiles
 */
function calculatePercentile(
  sortedArray: number[],
  percentile: number
): number {
  const index = Math.ceil((percentile / 100) * sortedArray.length) - 1
  return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))]
}

/**
 * Format Threader results
 */
function formatThreaderResults(results: ThreaderTestResult[]): void {
  console.log('\n🚀 THREADER PERFORMANCE RESULTS')
  console.log('=' * 80)

  for (const result of results) {
    console.log(`\n🔸 ${result.testName}`)
    console.log(`   Backend: ${result.backendUsed.toUpperCase()}`)
    console.log(`   Operations: ${result.totalOperations.toLocaleString()}`)
    console.log(`   Total Time: ${result.totalTimeMs.toFixed(2)}ms`)
    console.log(
      `   Tasks/Second: ${Math.round(
        result.tasksPerSecond || result.opsPerSecond
      ).toLocaleString()}`
    )
    console.log(`   Avg Latency: ${result.avgLatencyMs.toFixed(2)}ms`)
    console.log(
      `   Min/Max: ${result.minLatencyMs.toFixed(
        2
      )}ms / ${result.maxLatencyMs.toFixed(2)}ms`
    )
    console.log(
      `   P95/P99: ${result.p95LatencyMs.toFixed(
        2
      )}ms / ${result.p99LatencyMs.toFixed(2)}ms`
    )
    if (result.overhead > 0) {
      console.log(`   Overhead: ${result.overhead.toFixed(1)}x vs baseline`)
    }
  }

  // Performance summary
  console.log('\n📊 THREADER ANALYSIS')
  console.log('=' * 50)

  const rustResults = results.filter(r => r.backendUsed === 'rust')
  const jsResults = results.filter(r => r.backendUsed === 'javascript')

  if (rustResults.length > 0) {
    const avgRustPerf =
      rustResults.reduce((sum, r) => sum + r.tasksPerSecond, 0) /
      rustResults.length
    console.log(
      `   Rust Backend Avg: ${Math.round(
        avgRustPerf
      ).toLocaleString()} tasks/sec`
    )
  }

  if (jsResults.length > 0) {
    const avgJsPerf =
      jsResults.reduce((sum, r) => sum + r.tasksPerSecond, 0) / jsResults.length
    console.log(
      `   JS Worker Avg: ${Math.round(avgJsPerf).toLocaleString()} tasks/sec`
    )
  }

  const overheads = results.filter(r => r.overhead > 0).map(r => r.overhead)
  if (overheads.length > 0) {
    const avgOverhead =
      overheads.reduce((sum, o) => sum + o, 0) / overheads.length
    console.log(
      `   Avg Overhead: ${avgOverhead.toFixed(1)}x vs direct execution`
    )
  }
}

/**
 * Main test runner
 */
export async function runThreaderPerformanceTest(): Promise<void> {
  console.log('🚀 Threader Real-World Performance Test')
  console.log('   (This will take a few minutes...)')

  try {
    const results = await testThreaderPerformance()
    formatThreaderResults(results)

    // Compare with baseline expectations
    console.log('\n💡 RECOMMENDATIONS')
    console.log('=' * 30)

    const fastestTask = Math.max(...results.map(r => r.tasksPerSecond))
    const slowestTask = Math.min(...results.map(r => r.tasksPerSecond))

    console.log(
      `   Fastest Task Type: ${Math.round(
        fastestTask
      ).toLocaleString()} tasks/sec`
    )
    console.log(
      `   Slowest Task Type: ${Math.round(
        slowestTask
      ).toLocaleString()} tasks/sec`
    )

    if (fastestTask > 100000) {
      console.log('   ✅ Excellent performance for simple operations')
    } else {
      console.log('   ⚠️  Performance may be limited by worker overhead')
    }

    const avgOverhead =
      results
        .filter(r => r.overhead > 0)
        .reduce((sum, r) => sum + r.overhead, 0) /
      results.filter(r => r.overhead > 0).length

    if (avgOverhead < 10) {
      console.log('   ✅ Low overhead vs direct execution')
    } else if (avgOverhead < 100) {
      console.log('   ⚠️  Moderate overhead - consider task batching')
    } else {
      console.log('   ❌ High overhead - only use for CPU-intensive tasks')
    }
  } catch (error) {
    console.error('❌ Threader performance test failed:', error.message)
    console.error('Stack:', error.stack)
  }
}

// CLI runner
runThreaderPerformanceTest()
