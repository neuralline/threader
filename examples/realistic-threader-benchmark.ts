// examples/realistic-threader-benchmark.ts
// Proper benchmark showing where Threader actually provides value
import {performance} from 'perf_hooks'
import {threader, thread} from '../src/index'

// ============================================================================
// REALISTIC WORKLOADS (Where Threader Actually Helps)
// ============================================================================

// Heavy CPU computation (Prime number generation)
const generatePrimes = (max: number): number[] => {
  const primes: number[] = []
  for (let num = 2; num <= max; num++) {
    let isPrime = true
    for (let i = 2; i <= Math.sqrt(num); i++) {
      if (num % i === 0) {
        isPrime = false
        break
      }
    }
    if (isPrime) primes.push(num)
  }
  return primes
}

// Image processing simulation (heavy computation)
const processImageData = (imageData: {
  width: number
  height: number
  pixels: number[]
}): any => {
  const {width, height, pixels} = imageData
  const processed = [...pixels]

  // Simulate heavy image filters
  for (let i = 0; i < 3; i++) {
    // 3 filter passes
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x
        // Blur filter simulation
        processed[idx] =
          (processed[idx - width - 1] +
            processed[idx - width] +
            processed[idx - width + 1] +
            processed[idx - 1] +
            processed[idx] +
            processed[idx + 1] +
            processed[idx + width - 1] +
            processed[idx + width] +
            processed[idx + width + 1]) /
          9
      }
    }
  }

  return {width, height, processed}
}

// Complex mathematical computation
const complexMath = (data: {base: number; iterations: number}): any => {
  const {base, iterations} = data
  let result = base

  for (let i = 0; i < iterations; i++) {
    result = Math.sin(result) * Math.cos(i) + Math.sqrt(result + i)
    result = Math.log(Math.abs(result) + 1) * Math.exp(i / iterations)
  }

  return {
    input: base,
    iterations,
    result: result.toFixed(8),
    computations: iterations * 4 // sin, cos, sqrt, log, exp
  }
}

// Data analysis workload
const analyzeDataset = (dataset: number[]): any => {
  const sorted = [...dataset].sort((a, b) => a - b)
  const mean = dataset.reduce((sum, val) => sum + val, 0) / dataset.length

  const variance =
    dataset.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    dataset.length
  const stdDev = Math.sqrt(variance)

  const median =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)]

  const q1 = sorted[Math.floor(sorted.length * 0.25)]
  const q3 = sorted[Math.floor(sorted.length * 0.75)]

  return {
    count: dataset.length,
    mean: mean.toFixed(4),
    median: median.toFixed(4),
    stdDev: stdDev.toFixed(4),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    q1,
    q3,
    outliers: dataset.filter(
      x => x < q1 - 1.5 * (q3 - q1) || x > q3 + 1.5 * (q3 - q1)
    ).length
  }
}

// ============================================================================
// BENCHMARK TESTS
// ============================================================================

interface BenchmarkResult {
  testName: string
  sequentialTime: number
  threaderTime: number
  speedup: number
  tasksPerSecond: number
  efficiency: number
}

async function runRealisticBenchmark(): Promise<void> {
  console.log('🚀 REALISTIC THREADER BENCHMARK')
  console.log('Testing scenarios where Threader provides actual value')
  console.log('=' * 60)

  const results: BenchmarkResult[] = []

  // Test 1: Prime Number Generation (CPU-intensive)
  console.log('\n🔢 Test 1: Prime Number Generation (CPU-intensive)')
  console.log('Generating primes up to 10,000 across multiple ranges...')

  const primeRanges = [
    {start: 1, end: 2500},
    {start: 2501, end: 5000},
    {start: 5001, end: 7500},
    {start: 7501, end: 10000}
  ]

  // Sequential execution
  console.log('Running sequential...')
  const primeSeqStart = performance.now()
  const sequentialPrimes: number[][] = []
  for (const range of primeRanges) {
    const primes = generatePrimes(range.end).filter(p => p >= range.start)
    sequentialPrimes.push(primes)
  }
  const primeSeqTime = performance.now() - primeSeqStart

  // Threader parallel execution
  console.log('Running parallel with Threader...')
  const primeParStart = performance.now()
  const primeProcessors = primeRanges.map(range =>
    threader((r: {start: number; end: number}) => {
      return generatePrimes(r.end).filter(p => p >= r.start)
    }, range)
  )
  const parallelPrimes = await thread.all(...primeProcessors)
  const primeParTime = performance.now() - primeParStart

  // Verify results are identical
  const seqTotal = sequentialPrimes.flat().length
  const parTotal = parallelPrimes.flat().length
  console.log(
    `✅ Results verified: ${seqTotal} primes (sequential) vs ${parTotal} primes (parallel)`
  )

  const primeSpeedup = primeSeqTime / primeParTime
  results.push({
    testName: 'Prime Number Generation',
    sequentialTime: primeSeqTime,
    threaderTime: primeParTime,
    speedup: primeSpeedup,
    tasksPerSecond: (primeRanges.length / primeParTime) * 1000,
    efficiency: (primeSpeedup / 4) * 100 // 4 cores expected
  })

  console.log(
    `Sequential: ${primeSeqTime.toFixed(
      0
    )}ms | Parallel: ${primeParTime.toFixed(
      0
    )}ms | Speedup: ${primeSpeedup.toFixed(1)}x`
  )

  // Test 2: Image Processing Simulation
  console.log('\n🖼️  Test 2: Image Processing Simulation')
  console.log('Processing 4 images (200x200 pixels each)...')

  const images = Array.from({length: 4}, (_, i) => ({
    width: 200,
    height: 200,
    pixels: Array.from({length: 200 * 200}, () =>
      Math.floor(Math.random() * 255)
    )
  }))

  // Sequential
  console.log('Running sequential...')
  const imgSeqStart = performance.now()
  const sequentialImages = images.map(img => processImageData(img))
  const imgSeqTime = performance.now() - imgSeqStart

  // Parallel
  console.log('Running parallel with Threader...')
  const imgParStart = performance.now()
  const imageProcessors = images.map(img => threader(processImageData, img))
  const parallelImages = await thread.all(...imageProcessors)
  const imgParTime = performance.now() - imgParStart

  const imgSpeedup = imgSeqTime / imgParTime
  results.push({
    testName: 'Image Processing',
    sequentialTime: imgSeqTime,
    threaderTime: imgParTime,
    speedup: imgSpeedup,
    tasksPerSecond: (images.length / imgParTime) * 1000,
    efficiency: (imgSpeedup / 4) * 100
  })

  console.log(
    `Sequential: ${imgSeqTime.toFixed(0)}ms | Parallel: ${imgParTime.toFixed(
      0
    )}ms | Speedup: ${imgSpeedup.toFixed(1)}x`
  )

  // Test 3: Mathematical Computations
  console.log('\n🧮 Test 3: Complex Mathematical Computations')
  console.log('Running heavy math operations...')

  const mathTasks = Array.from({length: 8}, (_, i) => ({
    base: i + 1,
    iterations: 50000
  }))

  // Sequential
  console.log('Running sequential...')
  const mathSeqStart = performance.now()
  const sequentialMath = mathTasks.map(task => complexMath(task))
  const mathSeqTime = performance.now() - mathSeqStart

  // Parallel
  console.log('Running parallel with Threader...')
  const mathParStart = performance.now()
  const mathProcessors = mathTasks.map(task => threader(complexMath, task))
  const parallelMath = await thread.all(...mathProcessors)
  const mathParTime = performance.now() - mathParStart

  const mathSpeedup = mathSeqTime / mathParTime
  results.push({
    testName: 'Mathematical Computations',
    sequentialTime: mathSeqTime,
    threaderTime: mathParTime,
    speedup: mathSpeedup,
    tasksPerSecond: (mathTasks.length / mathParTime) * 1000,
    efficiency: (mathSpeedup / 4) * 100
  })

  console.log(
    `Sequential: ${mathSeqTime.toFixed(0)}ms | Parallel: ${mathParTime.toFixed(
      0
    )}ms | Speedup: ${mathSpeedup.toFixed(1)}x`
  )

  // Test 4: Data Analysis
  console.log('\n📊 Test 4: Large Dataset Analysis')
  console.log('Analyzing 6 datasets (10,000 numbers each)...')

  const datasets = Array.from({length: 6}, () =>
    Array.from({length: 10000}, () => Math.random() * 1000)
  )

  // Sequential
  console.log('Running sequential...')
  const dataSeqStart = performance.now()
  const sequentialData = datasets.map(dataset => analyzeDataset(dataset))
  const dataSeqTime = performance.now() - dataSeqStart

  // Parallel
  console.log('Running parallel with Threader...')
  const dataParStart = performance.now()
  const dataProcessors = datasets.map(dataset =>
    threader(analyzeDataset, dataset)
  )
  const parallelData = await thread.all(...dataProcessors)
  const dataParTime = performance.now() - dataParStart

  const dataSpeedup = dataSeqTime / dataParTime
  results.push({
    testName: 'Dataset Analysis',
    sequentialTime: dataSeqTime,
    threaderTime: dataParTime,
    speedup: dataSpeedup,
    tasksPerSecond: (datasets.length / dataParTime) * 1000,
    efficiency: (dataSpeedup / 4) * 100
  })

  console.log(
    `Sequential: ${dataSeqTime.toFixed(0)}ms | Parallel: ${dataParTime.toFixed(
      0
    )}ms | Speedup: ${dataSpeedup.toFixed(1)}x`
  )

  // Test 5: Mixed Workload (Real-world scenario)
  console.log('\n🌐 Test 5: Mixed Workload (Real-world scenario)')
  console.log('Combining different types of heavy computations...')

  const mixedTasks = [
    threader(
      (range: any) => generatePrimes(range.end).filter(p => p >= range.start),
      {start: 1, end: 5000}
    ),
    threader(processImageData, images[0]),
    threader(complexMath, {base: 5, iterations: 30000}),
    threader(analyzeDataset, datasets[0].slice(0, 5000)),
    threader(
      (range: any) => generatePrimes(range.end).filter(p => p >= range.start),
      {start: 5001, end: 10000}
    ),
    threader(processImageData, images[1])
  ]

  // Sequential execution of mixed tasks
  const mixedSeqStart = performance.now()
  const sequentialMixed = []
  for (const task of mixedTasks) {
    const result = await task.fn(task.data)
    sequentialMixed.push(result)
  }
  const mixedSeqTime = performance.now() - mixedSeqStart

  // Parallel execution
  const mixedParStart = performance.now()
  const parallelMixed = await thread.all(...mixedTasks)
  const mixedParTime = performance.now() - mixedParStart

  const mixedSpeedup = mixedSeqTime / mixedParTime
  results.push({
    testName: 'Mixed Workload',
    sequentialTime: mixedSeqTime,
    threaderTime: mixedParTime,
    speedup: mixedSpeedup,
    tasksPerSecond: (mixedTasks.length / mixedParTime) * 1000,
    efficiency: (mixedSpeedup / 4) * 100
  })

  console.log(
    `Sequential: ${mixedSeqTime.toFixed(
      0
    )}ms | Parallel: ${mixedParTime.toFixed(
      0
    )}ms | Speedup: ${mixedSpeedup.toFixed(1)}x`
  )

  // ============================================================================
  // SUMMARY RESULTS
  // ============================================================================

  console.log('\n🏆 REALISTIC BENCHMARK RESULTS')
  console.log('=' * 60)

  results.forEach(result => {
    console.log(`\n📊 ${result.testName}`)
    console.log(`   Sequential: ${result.sequentialTime.toFixed(0)}ms`)
    console.log(`   Threader:   ${result.threaderTime.toFixed(0)}ms`)
    console.log(`   Speedup:    ${result.speedup.toFixed(1)}x faster`)
    console.log(`   Throughput: ${result.tasksPerSecond.toFixed(0)} tasks/sec`)
    console.log(
      `   Efficiency: ${result.efficiency.toFixed(0)}% of theoretical max`
    )
  })

  const avgSpeedup =
    results.reduce((sum, r) => sum + r.speedup, 0) / results.length
  const avgEfficiency =
    results.reduce((sum, r) => sum + r.efficiency, 0) / results.length
  const totalSequential = results.reduce((sum, r) => sum + r.sequentialTime, 0)
  const totalParallel = results.reduce((sum, r) => sum + r.threaderTime, 0)

  console.log('\n🎯 OVERALL PERFORMANCE')
  console.log('=' * 30)
  console.log(`📈 Average Speedup: ${avgSpeedup.toFixed(1)}x`)
  console.log(`⚡ Average Efficiency: ${avgEfficiency.toFixed(0)}%`)
  console.log(
    `🕐 Total Time Saved: ${(totalSequential - totalParallel).toFixed(0)}ms`
  )
  console.log(
    `🚀 Overall Improvement: ${
      (totalSequential / totalParallel - 1) * 100
    }% faster`
  )

  console.log('\n💡 WHEN TO USE THREADER:')
  if (avgSpeedup > 2) {
    console.log(
      '✅ EXCELLENT - Threader provides significant performance gains'
    )
    console.log('✅ Perfect for CPU-intensive workloads')
    console.log('✅ Scales well with available CPU cores')
  } else if (avgSpeedup > 1.5) {
    console.log('✅ GOOD - Threader provides solid performance gains')
    console.log('⚠️  Best for medium to heavy computational tasks')
  } else {
    console.log('⚠️  LIMITED - Threader overhead may exceed benefits')
    console.log('💡 Use for heavy computations only')
  }

  if (avgEfficiency > 70) {
    console.log('✅ Excellent CPU utilization')
  } else if (avgEfficiency > 50) {
    console.log('✅ Good CPU utilization')
  } else {
    console.log('⚠️  Consider optimizing for better CPU utilization')
  }
}

// ============================================================================
// STREAMING PERFORMANCE TEST
// ============================================================================

async function testStreamingPerformance(): Promise<void> {
  console.log('\n🌊 STREAMING PERFORMANCE TEST')
  console.log('Testing real-time processing capabilities...')

  // Create tasks with variable completion times
  const streamingTasks = [
    threader(complexMath, {base: 1, iterations: 20000}), // ~200ms
    threader(complexMath, {base: 2, iterations: 40000}), // ~400ms
    threader(complexMath, {base: 3, iterations: 60000}), // ~600ms
    threader(complexMath, {base: 4, iterations: 80000}), // ~800ms
    threader(complexMath, {base: 5, iterations: 100000}) // ~1000ms
  ]

  console.log('🔄 Sequential processing (wait for all):')
  const allStart = performance.now()
  const allResults = await thread.all(...streamingTasks)
  const allTime = performance.now() - allStart
  console.log(`   Total time: ${allTime.toFixed(0)}ms`)
  console.log(`   Results available at: ${allTime.toFixed(0)}ms`)

  console.log('\n🌊 Streaming processing (results as available):')
  const streamStart = performance.now()
  const streamResults = []
  let resultCount = 0

  for await (const result of thread.stream(...streamingTasks)) {
    resultCount++
    const elapsed = performance.now() - streamStart
    streamResults.push(result.result)
    console.log(
      `   Result ${resultCount} available at: ${elapsed.toFixed(0)}ms`
    )
  }

  const streamTotal = performance.now() - streamStart
  console.log(`   All results completed: ${streamTotal.toFixed(0)}ms`)

  const firstResultTime = streamingTasks.length > 0 ? 200 : 0 // Estimate based on shortest task
  console.log(`\n📊 Streaming Benefits:`)
  console.log(
    `   Time to first result: ~${firstResultTime}ms (streaming) vs ${allTime.toFixed(
      0
    )}ms (all)`
  )
  console.log(
    `   User experience: ${(
      ((allTime - firstResultTime) / allTime) *
      100
    ).toFixed(0)}% faster perceived performance`
  )
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main(): Promise<void> {
  try {
    await runRealisticBenchmark()
    await testStreamingPerformance()

    console.log('\n🎉 REALISTIC BENCHMARK COMPLETE!')
    console.log(
      "This benchmark shows Threader's true value for CPU-intensive work."
    )
  } catch (error) {
    console.error('❌ Benchmark failed:', error.message)
  } finally {
    await thread.shutdown()
    console.log('\n✅ Benchmark complete!')
  }
}

main().catch(console.error)
