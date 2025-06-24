// examples/baseline.ts
import {performance} from 'perf_hooks'
import * as os from 'os'

interface BenchmarkResult {
  testName: string
  totalOperations: number
  totalTimeMs: number
  opsPerSecond: number
  avgLatencyMs: number
  minLatencyMs: number
  maxLatencyMs: number
  p95LatencyMs: number
  p99LatencyMs: number
}

interface SystemInfo {
  platform: string
  arch: string
  cpuCores: number
  cpuModel: string
  totalMemoryGB: number
  nodeVersion: string
}

/**
 * Get system information for benchmark context
 */
function getSystemInfo(): SystemInfo {
  const cpus = os.cpus()
  const totalMemory = os.totalmem()

  return {
    platform: os.platform(),
    arch: os.arch(),
    cpuCores: cpus.length,
    cpuModel: cpus[0]?.model || 'Unknown',
    totalMemoryGB: Math.round((totalMemory / 1024 ** 3) * 100) / 100,
    nodeVersion: process.version
  }
}

/**
 * Calculate percentiles from sorted array
 */
function calculatePercentile(
  sortedArray: number[],
  percentile: number
): number {
  const index = Math.ceil((percentile / 100) * sortedArray.length) - 1
  return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))]
}

/**
 * Run a baseline performance test
 */
async function runBaselineTest(
  testName: string,
  operation: () => any,
  iterations: number = 100000,
  warmupIterations: number = 1000
): Promise<BenchmarkResult> {
  //console.log(`\n🔥 Warming up ${testName}...`)

  // Warmup phase
  for (let i = 0; i < warmupIterations; i++) {
    operation()
  }

  // Force garbage collection if available
  if (global.gc) {
    global.gc()
  }

  //   console.log(
  //     `📊 Running ${testName} (${iterations.toLocaleString()} operations)...`
  //   )

  const latencies: number[] = []
  const startTime = performance.now()

  // Main benchmark loop
  for (let i = 0; i < iterations; i++) {
    const opStart = performance.now()
    operation()
    const opEnd = performance.now()
    latencies.push(opEnd - opStart)
  }

  const endTime = performance.now()
  const totalTimeMs = endTime - startTime

  // Sort latencies for percentile calculation
  latencies.sort((a, b) => a - b)

  const result: BenchmarkResult = {
    testName,
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

  return result
}

/**
 * Test function serialization performance
 */
function testFunctionSerialization(): BenchmarkResult[] {
  const testFunctions = [
    {name: 'Simple Arrow', fn: (x: number) => x * 2},
    {name: 'Complex Arrow', fn: (x: number) => Math.sqrt(x * x + 1)},
    {name: 'String Method', fn: (s: string) => s.toLowerCase().trim()},
    {name: 'Array Method', fn: (arr: number[]) => arr.filter(x => x > 0).length}
  ]

  const results: BenchmarkResult[] = []

  for (const test of testFunctions) {
    const result = runBaselineTest(
      `Serialize ${test.name}`,
      () => test.fn.toString(),
      50000,
      500
    )
    results.push(result)
  }

  return results
}

/**
 * Test JSON serialization performance
 */
function testJsonSerialization(): BenchmarkResult[] {
  const testData = [
    {name: 'Small Object', data: {id: 1, name: 'test', value: 42}},
    {
      name: 'Large Object',
      data: {
        users: Array.from({length: 100}, (_, i) => ({
          id: i,
          name: `user${i}`,
          data: Array.from({length: 10}, (_, j) => j * i)
        }))
      }
    },
    {name: 'Number Array', data: Array.from({length: 1000}, (_, i) => i)},
    {
      name: 'String Array',
      data: Array.from({length: 100}, (_, i) => `string_${i}`.repeat(10))
    }
  ]

  const results: BenchmarkResult[] = []

  for (const test of testData) {
    const result = runBaselineTest(
      `JSON.stringify ${test.name}`,
      () => JSON.stringify(test.data),
      10000,
      100
    )
    results.push(result)
  }

  return results
}

/**
 * Test basic computation performance (baseline for comparison)
 */
function testBasicComputations(): BenchmarkResult[] {
  const tests = [
    {
      name: 'Arithmetic (x * 2)',
      op: () => {
        const x = Math.random() * 1000
        return x * 2
      }
    },
    {
      name: 'String toLowerCase',
      op: () => {
        const str = `Hello World ${Math.random()}`
        return str.toLowerCase()
      }
    },
    {
      name: 'Array filter + length',
      op: () => {
        const arr = Array.from({length: 100}, () => Math.random() * 100)
        return arr.filter(x => x > 50).length
      }
    },
    {
      name: 'Math.sqrt computation',
      op: () => {
        const x = Math.random() * 1000
        return Math.sqrt(x * x + 1)
      }
    }
  ]

  const results: BenchmarkResult[] = []

  for (const test of tests) {
    const result = runBaselineTest(
      `Compute ${test.name}`,
      test.op,
      100000,
      1000
    )
    results.push(result)
  }

  return results
}

/**
 * Format benchmark results for display
 */
function formatResults(results: BenchmarkResult[]): void {
  console.log('\n📈 BENCHMARK RESULTS')
  console.log('=' * 80)

  for (const result of results) {
    console.log(`\n🔸 ${result.testName}`)
    console.log(`   Operations: ${result.totalOperations.toLocaleString()}`)
    console.log(`   Total Time: ${result.totalTimeMs.toFixed(2)}ms`)
    console.log(
      `   Ops/Second: ${Math.round(result.opsPerSecond).toLocaleString()}`
    )
    console.log(`   Avg Latency: ${result.avgLatencyMs.toFixed(4)}ms`)
    console.log(
      `   Min/Max: ${result.minLatencyMs.toFixed(
        4
      )}ms / ${result.maxLatencyMs.toFixed(2)}ms`
    )
    console.log(
      `   P95/P99: ${result.p95LatencyMs.toFixed(
        4
      )}ms / ${result.p99LatencyMs.toFixed(4)}ms`
    )
  }
}

/**
 * Main benchmark runner
 */
export async function runBaselinePerformanceTest(): Promise<void> {
  console.log('🚀 Threader Baseline Performance Test')

  const systemInfo = getSystemInfo()
  console.log('\n💻 System Information:')
  console.log(`   Platform: ${systemInfo.platform} ${systemInfo.arch}`)
  console.log(`   CPU: ${systemInfo.cpuModel} (${systemInfo.cpuCores} cores)`)
  console.log(`   Memory: ${systemInfo.totalMemoryGB} GB`)
  console.log(`   Node.js: ${systemInfo.nodeVersion}`)

  try {
    // Test 1: Function serialization (core to threader performance)
    console.log('\n🧪 Testing Function Serialization...')
    const serializationResults = await Promise.all(testFunctionSerialization())

    // Test 2: JSON serialization (data transfer performance)
    console.log('\n🧪 Testing JSON Serialization...')
    const jsonResults = await Promise.all(testJsonSerialization())

    // Test 3: Basic computations (baseline performance)
    console.log('\n🧪 Testing Basic Computations...')
    const computationResults = await Promise.all(testBasicComputations())

    // Display all results
    const allResults = [
      ...serializationResults,
      ...jsonResults,
      ...computationResults
    ]
    formatResults(allResults)

    // Summary insights
    const fastestOps = Math.max(...allResults.map(r => r.opsPerSecond))
    const slowestOps = Math.min(...allResults.map(r => r.opsPerSecond))

    console.log('\n📊 PERFORMANCE INSIGHTS')
    console.log('=' * 50)
    console.log(
      `   Fastest Operation: ${Math.round(fastestOps).toLocaleString()} ops/sec`
    )
    console.log(
      `   Slowest Operation: ${Math.round(slowestOps).toLocaleString()} ops/sec`
    )
    console.log(
      `   Performance Range: ${Math.round(fastestOps / slowestOps)}x difference`
    )

    // Threader-specific insights
    const serializationOps = serializationResults.map(r => r.opsPerSecond)
    const avgSerializationOps =
      serializationOps.reduce((sum, ops) => sum + ops, 0) /
      serializationOps.length

    console.log(`\n🔧 Threader Performance Factors:`)
    console.log(
      `   Avg Function Serialization: ${Math.round(
        avgSerializationOps
      ).toLocaleString()} ops/sec`
    )
    console.log(
      `   Est. Max Threader Throughput: ~${Math.round(
        avgSerializationOps / 10
      ).toLocaleString()} tasks/sec`
    )
    console.log(`   (Limited by serialization overhead)`)
  } catch (error) {
    console.error('❌ Benchmark failed:', error.message)
  }
}

/**
 * Run specific subset of tests
 */
export async function runQuickBaselineTest(): Promise<void> {
  console.log('⚡ Quick Baseline Test')

  const quickTests = [
    runBaselineTest(
      'Function toString()',
      () => ((x: number) => x * 2).toString(),
      10000
    ),
    runBaselineTest(
      'JSON.stringify',
      () => JSON.stringify({id: 1, data: [1, 2, 3]}),
      10000
    ),
    runBaselineTest('Simple Math', () => Math.sqrt(42 * 42 + 1), 50000)
  ]

  const results = await Promise.all(quickTests)
  formatResults(results)
}

// Export the benchmark result type for external use
export type {BenchmarkResult, SystemInfo}

// CLI runner if called directly
if (require.main === module) {
  const arg = process.argv[2]
  if (arg === '--quick') {
    runQuickBaselineTest()
  } else {
    runBaselinePerformanceTest()
  }
}
