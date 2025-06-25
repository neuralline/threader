// examples/heavy-workload-benchmark.ts
// Benchmark with TRULY heavy computations that justify parallelism overhead
import {performance} from 'perf_hooks'
import {threader, thread} from '../src/index'

// ============================================================================
// SERIOUSLY HEAVY WORKLOADS (Seconds, not milliseconds)
// ============================================================================

// Heavy prime generation (much larger range)
const generateHeavyPrimes = (max: number): number[] => {
  console.log(`  🔢 Generating primes up to ${max.toLocaleString()}...`)
  const primes: number[] = []
  for (let num = 2; num <= max; num++) {
    let isPrime = true
    const sqrt = Math.sqrt(num)
    for (let i = 2; i <= sqrt; i++) {
      if (num % i === 0) {
        isPrime = false
        break
      }
    }
    if (isPrime) primes.push(num)
  }
  console.log(`  ✅ Found ${primes.length} primes`)
  return primes
}

// Heavy matrix multiplication simulation
const heavyMatrixOperation = (size: number): number => {
  console.log(`  🧮 Matrix operations (${size}x${size})...`)
  let result = 0

  // Create and multiply large matrices
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      for (let k = 0; k < size; k++) {
        // Simulate matrix multiplication work
        result += Math.sin(i * j * k) * Math.cos(i + j + k)
      }
    }
  }

  console.log(`  ✅ Matrix computation complete`)
  return result
}

// Heavy image processing (much larger)
const heavyImageProcessing = (imageData: {
  width: number
  height: number
}): any => {
  const {width, height} = imageData
  console.log(`  🖼️  Processing ${width}x${height} image...`)

  // Generate large image data
  const pixels = Array.from({length: width * height}, () =>
    Math.floor(Math.random() * 255)
  )
  let processed = [...pixels]

  // Apply many heavy filter passes
  for (let pass = 0; pass < 10; pass++) {
    const newProcessed = [...processed]

    // Complex multi-pass filtering
    for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        const idx = y * width + x

        // 5x5 convolution kernel (much heavier than 3x3)
        let sum = 0
        for (let ky = -2; ky <= 2; ky++) {
          for (let kx = -2; kx <= 2; kx++) {
            const kidx = (y + ky) * width + (x + kx)
            sum += processed[kidx] * Math.sin(kx * ky + pass)
          }
        }
        newProcessed[idx] = Math.abs(sum / 25)
      }
    }
    processed = newProcessed
  }

  console.log(`  ✅ Image processing complete`)
  return {width, height, checksum: processed.reduce((a, b) => a + b, 0)}
}

// Heavy data crunching (large dataset with complex operations)
const heavyDataCrunching = (dataSize: number): any => {
  console.log(`  📊 Crunching ${dataSize.toLocaleString()} data points...`)

  // Generate large dataset
  const data = Array.from(
    {length: dataSize},
    (_, i) => Math.sin(i) * 1000 + Math.cos(i * 2) * 500
  )

  // Heavy statistical computations
  const sorted = [...data].sort((a, b) => a - b)
  const mean = data.reduce((sum, val) => sum + val, 0) / data.length

  // Multiple passes of heavy computations
  let variance = 0
  let skewness = 0
  let kurtosis = 0

  for (const val of data) {
    const diff = val - mean
    const diff2 = diff * diff
    const diff3 = diff2 * diff
    const diff4 = diff3 * diff

    variance += diff2
    skewness += diff3
    kurtosis += diff4
  }

  variance /= data.length
  const stdDev = Math.sqrt(variance)
  skewness = skewness / (data.length * Math.pow(stdDev, 3))
  kurtosis = kurtosis / (data.length * Math.pow(stdDev, 4)) - 3

  // Heavy correlation matrix (O(n²))
  const correlations: number[] = []
  const chunkSize = 1000
  for (let i = 0; i < data.length; i += chunkSize) {
    for (let j = i; j < data.length; j += chunkSize) {
      const chunk1 = data.slice(i, Math.min(i + chunkSize, data.length))
      const chunk2 = data.slice(j, Math.min(j + chunkSize, data.length))

      // Pearson correlation
      const mean1 = chunk1.reduce((a, b) => a + b, 0) / chunk1.length
      const mean2 = chunk2.reduce((a, b) => a + b, 0) / chunk2.length

      let numerator = 0,
        denom1 = 0,
        denom2 = 0
      const minLength = Math.min(chunk1.length, chunk2.length)

      for (let k = 0; k < minLength; k++) {
        const diff1 = chunk1[k] - mean1
        const diff2 = chunk2[k] - mean2
        numerator += diff1 * diff2
        denom1 += diff1 * diff1
        denom2 += diff2 * diff2
      }

      const correlation = numerator / Math.sqrt(denom1 * denom2)
      if (!isNaN(correlation)) correlations.push(correlation)
    }
  }

  console.log(`  ✅ Data crunching complete`)
  return {
    dataSize,
    mean: mean.toFixed(4),
    stdDev: stdDev.toFixed(4),
    skewness: skewness.toFixed(4),
    kurtosis: kurtosis.toFixed(4),
    correlations: correlations.length,
    avgCorrelation: (
      correlations.reduce((a, b) => a + b, 0) / correlations.length
    ).toFixed(4)
  }
}

// Heavy Monte Carlo simulation
const heavyMonteCarloSimulation = (iterations: number): any => {
  console.log(
    `  🎲 Monte Carlo simulation (${iterations.toLocaleString()} iterations)...`
  )

  let insideCircle = 0
  let sumOfSquares = 0
  let productSum = 0

  for (let i = 0; i < iterations; i++) {
    const x = Math.random() * 2 - 1 // [-1, 1]
    const y = Math.random() * 2 - 1 // [-1, 1]
    const z = Math.random() * 2 - 1 // [-1, 1]

    // Multiple heavy calculations per iteration
    if (x * x + y * y <= 1) insideCircle++

    sumOfSquares += x * x + y * y + z * z
    productSum += Math.sin(x * y * z) * Math.cos(x + y + z)

    // Additional heavy math to make it truly CPU-intensive
    if (i % 1000 === 0) {
      for (let j = 0; j < 100; j++) {
        productSum += Math.exp(Math.sin(j * x)) * Math.log(Math.abs(y) + 1)
      }
    }
  }

  const piEstimate = (4 * insideCircle) / iterations
  const avgSumOfSquares = sumOfSquares / iterations
  const avgProduct = productSum / iterations

  console.log(`  ✅ Monte Carlo complete (π ≈ ${piEstimate.toFixed(6)})`)
  return {
    iterations,
    piEstimate: piEstimate.toFixed(6),
    avgSumOfSquares: avgSumOfSquares.toFixed(6),
    avgProduct: avgProduct.toFixed(6)
  }
}

// ============================================================================
// HEAVY WORKLOAD BENCHMARK
// ============================================================================

async function runHeavyWorkloadBenchmark(): Promise<void> {
  console.log('💪 HEAVY WORKLOAD BENCHMARK')
  console.log('Testing with computations that take seconds, not milliseconds')
  console.log('=' * 70)

  // Test 1: Heavy Prime Generation (much larger ranges)
  console.log('\n🔢 Test 1: Heavy Prime Generation')
  console.log('Generating primes in large ranges (this will take time)...')

  const heavyPrimeRanges = [
    100000, // 0-100k
    150000, // 0-150k
    200000, // 0-200k
    250000 // 0-250k
  ]

  console.log('🔄 Sequential execution:')
  const primeSeqStart = performance.now()
  const sequentialHeavyPrimes: number[][] = []
  for (const max of heavyPrimeRanges) {
    const primes = generateHeavyPrimes(max)
    sequentialHeavyPrimes.push(primes)
  }
  const primeSeqTime = performance.now() - primeSeqStart

  console.log('\n⚡ Parallel execution with Threader:')
  const primeParStart = performance.now()
  const heavyPrimeProcessors = heavyPrimeRanges.map(max =>
    threader(generateHeavyPrimes, max)
  )
  const parallelHeavyPrimes = await thread.all(...heavyPrimeProcessors)
  const primeParTime = performance.now() - primeParStart

  const primeSpeedup = primeSeqTime / primeParTime
  console.log(`\n📊 Prime Generation Results:`)
  console.log(`   Sequential: ${(primeSeqTime / 1000).toFixed(1)}s`)
  console.log(`   Parallel:   ${(primeParTime / 1000).toFixed(1)}s`)
  console.log(`   Speedup:    ${primeSpeedup.toFixed(1)}x`)
  console.log(
    `   Time saved: ${((primeSeqTime - primeParTime) / 1000).toFixed(1)}s`
  )

  // Test 2: Heavy Matrix Operations
  console.log('\n🧮 Test 2: Heavy Matrix Operations')
  console.log('Large matrix computations...')

  const matrixSizes = [300, 350, 400, 450] // These will take significant time

  console.log('🔄 Sequential execution:')
  const matrixSeqStart = performance.now()
  const sequentialMatrix: number[] = []
  for (const size of matrixSizes) {
    const result = heavyMatrixOperation(size)
    sequentialMatrix.push(result)
  }
  const matrixSeqTime = performance.now() - matrixSeqStart

  console.log('\n⚡ Parallel execution with Threader:')
  const matrixParStart = performance.now()
  const matrixProcessors = matrixSizes.map(size =>
    threader(heavyMatrixOperation, size)
  )
  const parallelMatrix = await thread.all(...matrixProcessors)
  const matrixParTime = performance.now() - matrixParStart

  const matrixSpeedup = matrixSeqTime / matrixParTime
  console.log(`\n📊 Matrix Operations Results:`)
  console.log(`   Sequential: ${(matrixSeqTime / 1000).toFixed(1)}s`)
  console.log(`   Parallel:   ${(matrixParTime / 1000).toFixed(1)}s`)
  console.log(`   Speedup:    ${matrixSpeedup.toFixed(1)}x`)
  console.log(
    `   Time saved: ${((matrixSeqTime - matrixParTime) / 1000).toFixed(1)}s`
  )

  // Test 3: Heavy Image Processing
  console.log('\n🖼️  Test 3: Heavy Image Processing')
  console.log('Large image processing with multiple filter passes...')

  const heavyImages = [
    {width: 1000, height: 1000},
    {width: 1200, height: 800},
    {width: 800, height: 1200},
    {width: 1500, height: 1000}
  ]

  console.log('🔄 Sequential execution:')
  const imageSeqStart = performance.now()
  const sequentialHeavyImages: any[] = []
  for (const img of heavyImages) {
    const result = heavyImageProcessing(img)
    sequentialHeavyImages.push(result)
  }
  const imageSeqTime = performance.now() - imageSeqStart

  console.log('\n⚡ Parallel execution with Threader:')
  const imageParStart = performance.now()
  const heavyImageProcessors = heavyImages.map(img =>
    threader(heavyImageProcessing, img)
  )
  const parallelHeavyImages = await thread.all(...heavyImageProcessors)
  const imageParTime = performance.now() - imageParStart

  const imageSpeedup = imageSeqTime / imageParTime
  console.log(`\n📊 Image Processing Results:`)
  console.log(`   Sequential: ${(imageSeqTime / 1000).toFixed(1)}s`)
  console.log(`   Parallel:   ${(imageParTime / 1000).toFixed(1)}s`)
  console.log(`   Speedup:    ${imageSpeedup.toFixed(1)}x`)
  console.log(
    `   Time saved: ${((imageSeqTime - imageParTime) / 1000).toFixed(1)}s`
  )

  // Test 4: Heavy Data Crunching
  console.log('\n📊 Test 4: Heavy Data Crunching')
  console.log('Large dataset statistical analysis...')

  const heavyDataSizes = [500000, 750000, 1000000, 1250000] // Half million to 1.25M points

  console.log('🔄 Sequential execution:')
  const dataSeqStart = performance.now()
  const sequentialHeavyData: any[] = []
  for (const size of heavyDataSizes) {
    const result = heavyDataCrunching(size)
    sequentialHeavyData.push(result)
  }
  const dataSeqTime = performance.now() - dataSeqStart

  console.log('\n⚡ Parallel execution with Threader:')
  const dataParStart = performance.now()
  const heavyDataProcessors = heavyDataSizes.map(size =>
    threader(heavyDataCrunching, size)
  )
  const parallelHeavyData = await thread.all(...heavyDataProcessors)
  const dataParTime = performance.now() - dataParStart

  const dataSpeedup = dataSeqTime / dataParTime
  console.log(`\n📊 Data Crunching Results:`)
  console.log(`   Sequential: ${(dataSeqTime / 1000).toFixed(1)}s`)
  console.log(`   Parallel:   ${(dataParTime / 1000).toFixed(1)}s`)
  console.log(`   Speedup:    ${dataSpeedup.toFixed(1)}x`)
  console.log(
    `   Time saved: ${((dataSeqTime - dataParTime) / 1000).toFixed(1)}s`
  )

  // Test 5: Heavy Monte Carlo
  console.log('\n🎲 Test 5: Heavy Monte Carlo Simulations')
  console.log('Multiple Monte Carlo simulations...')

  const monteCarloIterations = [5000000, 7500000, 10000000, 12500000] // Millions of iterations

  console.log('🔄 Sequential execution:')
  const monteSeqStart = performance.now()
  const sequentialMonte: any[] = []
  for (const iterations of monteCarloIterations) {
    const result = heavyMonteCarloSimulation(iterations)
    sequentialMonte.push(result)
  }
  const monteSeqTime = performance.now() - monteSeqStart

  console.log('\n⚡ Parallel execution with Threader:')
  const monteParStart = performance.now()
  const monteProcessors = monteCarloIterations.map(iterations =>
    threader(heavyMonteCarloSimulation, iterations)
  )
  const parallelMonte = await thread.all(...monteProcessors)
  const monteParTime = performance.now() - monteParStart

  const monteSpeedup = monteSeqTime / monteParTime
  console.log(`\n📊 Monte Carlo Results:`)
  console.log(`   Sequential: ${(monteSeqTime / 1000).toFixed(1)}s`)
  console.log(`   Parallel:   ${(monteParTime / 1000).toFixed(1)}s`)
  console.log(`   Speedup:    ${monteSpeedup.toFixed(1)}x`)
  console.log(
    `   Time saved: ${((monteSeqTime - monteParTime) / 1000).toFixed(1)}s`
  )

  // ============================================================================
  // OVERALL SUMMARY
  // ============================================================================

  const allSpeedups = [
    primeSpeedup,
    matrixSpeedup,
    imageSpeedup,
    dataSpeedup,
    monteSpeedup
  ]
  const allSequentialTimes = [
    primeSeqTime,
    matrixSeqTime,
    imageSeqTime,
    dataSeqTime,
    monteSeqTime
  ]
  const allParallelTimes = [
    primeParTime,
    matrixParTime,
    imageParTime,
    dataParTime,
    monteParTime
  ]

  const avgSpeedup = allSpeedups.reduce((a, b) => a + b, 0) / allSpeedups.length
  const totalSeqTime = allSequentialTimes.reduce((a, b) => a + b, 0)
  const totalParTime = allParallelTimes.reduce((a, b) => a + b, 0)
  const totalTimeSaved = totalSeqTime - totalParTime

  console.log('\n🏆 HEAVY WORKLOAD SUMMARY')
  console.log('=' * 40)
  console.log(`📈 Average Speedup: ${avgSpeedup.toFixed(1)}x`)
  console.log(`⏱️  Total Sequential Time: ${(totalSeqTime / 1000).toFixed(1)}s`)
  console.log(`⚡ Total Parallel Time: ${(totalParTime / 1000).toFixed(1)}s`)
  console.log(`💰 Total Time Saved: ${(totalTimeSaved / 1000).toFixed(1)}s`)
  console.log(
    `🚀 Overall Improvement: ${(
      (totalSeqTime / totalParTime - 1) *
      100
    ).toFixed(0)}% faster`
  )

  console.log('\n🎯 THREADER PERFORMANCE EVALUATION:')
  if (avgSpeedup >= 2.5) {
    console.log('🏆 EXCELLENT - Threader provides massive performance gains!')
    console.log('✅ Perfect for heavy computational workloads')
    console.log('✅ Justifies parallelism overhead with significant speedups')
  } else if (avgSpeedup >= 1.8) {
    console.log('✅ VERY GOOD - Threader provides solid performance benefits')
    console.log('✅ Good for CPU-intensive tasks')
  } else if (avgSpeedup >= 1.2) {
    console.log('✅ GOOD - Threader provides measurable benefits')
    console.log('⚠️  Best for sustained heavy computations')
  } else {
    console.log('⚠️  MARGINAL - Benefits may not justify overhead')
    console.log('💡 Consider heavier workloads or different approaches')
  }

  const efficiency = (avgSpeedup / 4) * 100 // Assuming 4 cores
  console.log(
    `⚙️  CPU Efficiency: ${efficiency.toFixed(0)}% (${avgSpeedup.toFixed(
      1
    )}x speedup on ~4 cores)`
  )

  if (totalTimeSaved > 10000) {
    // 10+ seconds saved
    console.log('💎 SIGNIFICANT TIME SAVINGS - User will definitely notice!')
  } else if (totalTimeSaved > 3000) {
    // 3+ seconds saved
    console.log('⏰ NOTICEABLE TIME SAVINGS - Good user experience improvement')
  } else {
    console.log(
      '⏱️  Minor time savings - Consider heavier workloads for better impact'
    )
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main(): Promise<void> {
  console.log('⚠️  WARNING: This benchmark uses HEAVY computations')
  console.log('Expected runtime: 2-5 minutes depending on your CPU')
  console.log(
    'Each test processes large amounts of data to show real parallelism benefits'
  )
  console.log('\nStarting in 3 seconds...\n')

  await new Promise(resolve => setTimeout(resolve, 3000))

  try {
    await runHeavyWorkloadBenchmark()

    console.log('\n🎉 HEAVY WORKLOAD BENCHMARK COMPLETE!')
    console.log(
      "This benchmark demonstrates Threader's value for truly heavy computations."
    )
    console.log(
      'For lighter tasks, the coordination overhead may exceed benefits.'
    )
  } catch (error) {
    console.error('❌ Heavy benchmark failed:', error.message)
  } finally {
    await thread.shutdown()
    console.log('\n✅ Heavy benchmark complete!')
  }
}

main().catch(console.error)
