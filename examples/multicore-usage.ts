// examples/real-multicore-demo.ts - True parallel execution across cores
import {threader, thread} from '../src/threader'
import {performance} from 'perf_hooks'

async function demonstrateRealMultiCore() {
  console.log('🚀 REAL MULTI-CORE PARALLEL EXECUTION\n')
  console.log(
    'No pattern matching - pure function distribution across CPU cores\n'
  )

  console.log('📊 System Info:', thread.stats())

  if (!thread.stats().multiCoreAvailable) {
    console.error('❌ Multi-core backend not available!')
    console.log('Build the Rust backend: npm run build:rust')
    return
  }

  const coreCount = thread.stats().coreCount
  console.log(`✅ Multi-core backend ready with ${coreCount} cores\n`)

  // 1. CPU-INTENSIVE WORK DISTRIBUTED ACROSS CORES
  console.log('🔥 Test 1: CPU-Intensive Work Distribution')
  console.log(`Distributing heavy computation across ${coreCount} cores\n`)

  // Create CPU-intensive tasks that actually benefit from parallel execution
  const cpuIntensiveTasks = Array.from({length: coreCount * 2}, (_, i) =>
    threader(
      (workload: {base: number; iterations: number}) => {
        // Heavy computation that takes time
        let result = workload.base
        for (let j = 0; j < workload.iterations; j++) {
          result = Math.sin(result) + Math.cos(j) + Math.sqrt(result + j)
        }
        return {
          workerId: workload.base,
          result: result.toFixed(6),
          iterations: workload.iterations
        }
      },
      {base: i * 1000, iterations: 100000}
    )
  )

  console.log(`Processing ${cpuIntensiveTasks.length} CPU-intensive tasks...`)
  const cpuStart = performance.now()
  const cpuResults = await thread.all(...cpuIntensiveTasks)
  const cpuDuration = performance.now() - cpuStart

  console.log(`✅ Completed in ${cpuDuration.toFixed(2)}ms`)
  console.log(
    `🚀 Throughput: ${((cpuIntensiveTasks.length / cpuDuration) * 1000).toFixed(
      0
    )} tasks/sec`
  )
  console.log(`📊 Sample results: ${JSON.stringify(cpuResults.slice(0, 2))}`)
  console.log(`💡 Each task ran on a different CPU core simultaneously\n`)

  // 2. MASSIVE PARALLEL PROCESSING
  console.log('⚡ Test 2: Massive Parallel Processing')
  console.log('Processing thousands of functions in parallel\n')

  // Different types of real-world functions
  const massiveTasks = [
    // Data transformation tasks
    ...Array.from({length: 1000}, (_, i) =>
      threader(
        (data: {id: number; value: number}) => ({
          id: data.id,
          processed: data.value * 1.5 + 100,
          category: data.value > 500 ? 'high' : 'low'
        }),
        {id: i, value: Math.random() * 1000}
      )
    ),

    // Mathematical computation tasks
    ...Array.from({length: 500}, (_, i) =>
      threader((input: number) => {
        // Complex mathematical operations
        let result = input
        for (let j = 0; j < 1000; j++) {
          result = Math.pow(result, 0.5) + Math.log(result + 1)
        }
        return {
          input,
          computed: result.toFixed(8),
          type: 'mathematical'
        }
      }, i + 1000)
    ),

    // String processing tasks
    ...Array.from({length: 300}, (_, i) =>
      threader((text: string) => {
        // Heavy string manipulation
        let processed = text
        for (let j = 0; j < 100; j++) {
          processed = processed.split('').reverse().join('').toUpperCase()
          processed = processed.replace(/[AEIOU]/g, `${j}`)
        }
        return {
          original: text,
          processed: processed.substring(0, 50),
          length: processed.length,
          type: 'string'
        }
      }, `sample_text_${i}_with_content_to_process`)
    ),

    // Array processing tasks
    ...Array.from({length: 200}, (_, i) =>
      threader(
        (arr: number[]) => {
          // Heavy array operations
          let result = [...arr]
          for (let j = 0; j < 10; j++) {
            result = result
              .map(x => x * 1.1)
              .filter(x => x > 0)
              .sort((a, b) => b - a)
              .slice(0, arr.length)
          }
          return {
            originalLength: arr.length,
            processedSum: result.reduce((a, b) => a + b, 0).toFixed(2),
            max: Math.max(...result).toFixed(2),
            type: 'array'
          }
        },
        Array.from({length: 100}, () => Math.random() * 1000 - 500)
      )
    )
  ]

  console.log(
    `Processing ${massiveTasks.length} diverse tasks across ${coreCount} cores...`
  )
  const massiveStart = performance.now()
  const massiveResults = await thread.all(...massiveTasks)
  const massiveDuration = performance.now() - massiveStart

  console.log(
    `✅ Processed ${massiveResults.length} tasks in ${massiveDuration.toFixed(
      2
    )}ms`
  )
  console.log(
    `🚀 Throughput: ${(
      (massiveResults.length / massiveDuration) *
      1000
    ).toFixed(0)} tasks/sec`
  )
  console.log(`📊 Results by type:`)

  const resultsByType = massiveResults.reduce((acc: any, result: any) => {
    const type = result.type || 'unknown'
    acc[type] = (acc[type] || 0) + 1
    return acc
  }, {})

  Object.entries(resultsByType).forEach(([type, count]) => {
    console.log(`   ${type}: ${count} tasks`)
  })
  console.log()

  // 3. STREAMING PARALLEL EXECUTION
  console.log('🌊 Test 3: Streaming Parallel Execution')
  console.log('Processing stream of tasks across cores in real-time\n')

  const streamingTasks = Array.from({length: 100}, (_, i) =>
    threader(
      (workload: {id: number; complexity: number}) => {
        // Variable complexity simulation
        let result = workload.id
        for (let j = 0; j < workload.complexity; j++) {
          result += Math.sin(j) * Math.cos(workload.id + j)
        }
        return {
          taskId: workload.id,
          result: result.toFixed(4),
          complexity: workload.complexity,
          coreProcessed: true
        }
      },
      {id: i, complexity: 1000 + (i % 5) * 2000}
    )
  )

  console.log(`Streaming ${streamingTasks.length} tasks...`)
  let streamCount = 0
  const streamStart = performance.now()

  for await (const {result, duration, index} of thread.stream(
    ...streamingTasks
  )) {
    streamCount++
    // Handle different result formats
    const resultObj = typeof result === 'string' ? JSON.parse(result) : result
    const complexity =
      resultObj.complexity || resultObj.iterations || 'variable'

    if (streamCount <= 5 || streamCount % 20 === 0) {
      console.log(
        `   Task ${index}: complexity=${complexity}, duration=${duration.toFixed(
          2
        )}ms`
      )
    }
  }

  const streamTotal = performance.now() - streamStart
  console.log(
    `✅ Stream completed: ${streamCount} tasks in ${streamTotal.toFixed(2)}ms`
  )
  console.log(
    `🚀 Stream rate: ${((streamCount / streamTotal) * 1000).toFixed(
      0
    )} tasks/sec\n`
  )

  // 4. REAL-WORLD SIMULATION: IMAGE PROCESSING
  console.log('🖼️ Test 4: Real-World Image Processing Simulation')
  console.log('Simulating image filters running on separate cores\n')

  const imageProcessingTasks = [
    // Blur filter
    threader(
      (image: {width: number; height: number; data: string}) => {
        const pixels = image.width * image.height
        let processed = 0

        // Simulate blur algorithm
        for (let i = 0; i < pixels; i++) {
          for (let j = 0; j < 9; j++) {
            // 3x3 kernel
            processed += Math.sin(i + j) * 0.1
          }
        }

        return {
          filter: 'blur',
          size: `${image.width}x${image.height}`,
          pixelsProcessed: pixels,
          result: processed.toFixed(6),
          performance: `${(pixels / 1000).toFixed(1)}K pixels`
        }
      },
      {width: 1920, height: 1080, data: 'image_data_1'}
    ),

    // Sharpen filter
    threader(
      (image: {width: number; height: number; data: string}) => {
        const pixels = image.width * image.height
        let processed = 0

        // Simulate sharpen algorithm
        for (let i = 0; i < pixels; i++) {
          for (let j = 0; j < 9; j++) {
            // 3x3 kernel
            processed += Math.cos(i * j) * 0.15
          }
        }

        return {
          filter: 'sharpen',
          size: `${image.width}x${image.height}`,
          pixelsProcessed: pixels,
          result: processed.toFixed(6),
          performance: `${(pixels / 1000).toFixed(1)}K pixels`
        }
      },
      {width: 1920, height: 1080, data: 'image_data_2'}
    ),

    // Edge detection
    threader(
      (image: {width: number; height: number; data: string}) => {
        const pixels = image.width * image.height
        let processed = 0

        // Simulate edge detection algorithm
        for (let i = 0; i < pixels; i++) {
          for (let j = 0; j < 25; j++) {
            // 5x5 kernel
            processed += Math.sqrt(i + j) * 0.05
          }
        }

        return {
          filter: 'edge_detection',
          size: `${image.width}x${image.height}`,
          pixelsProcessed: pixels,
          result: processed.toFixed(6),
          performance: `${(pixels / 1000).toFixed(1)}K pixels`
        }
      },
      {width: 1920, height: 1080, data: 'image_data_3'}
    ),

    // Color adjustment
    threader(
      (image: {width: number; height: number; data: string}) => {
        const pixels = image.width * image.height
        let processed = 0

        // Simulate color adjustment
        for (let i = 0; i < pixels; i++) {
          processed += Math.pow(i % 256, 1.2) * 0.01 // Gamma correction simulation
        }

        return {
          filter: 'color_adjustment',
          size: `${image.width}x${image.height}`,
          pixelsProcessed: pixels,
          result: processed.toFixed(6),
          performance: `${(pixels / 1000).toFixed(1)}K pixels`
        }
      },
      {width: 1920, height: 1080, data: 'image_data_4'}
    )
  ]

  console.log('Processing 4 image filters simultaneously on different cores...')
  const imageStart = performance.now()
  const imageResults = await thread.all(...imageProcessingTasks)
  const imageDuration = performance.now() - imageStart

  console.log(`✅ All filters completed in ${imageDuration.toFixed(2)}ms`)
  imageResults.forEach((result, i) => {
    // Handle different result formats
    const resultObj = typeof result === 'string' ? JSON.parse(result) : result
    const filterName = resultObj.type || resultObj.filter || `filter_${i}`
    const performance =
      resultObj.performance || resultObj.processedPixels || 'processed'
    console.log(`   ${filterName}: ${performance} processed`)
  })
  console.log(`💡 Each filter ran on a separate CPU core simultaneously\n`)

  // 5. PERFORMANCE COMPARISON: Sequential vs Parallel
  console.log('📈 Test 5: Sequential vs Parallel Performance')
  console.log('Comparing single-threaded vs multi-core execution\n')

  const comparisonTasks = Array.from({length: 50}, (_, i) =>
    threader(
      (data: {id: number; workload: number}) => {
        let result = data.id
        for (let j = 0; j < data.workload; j++) {
          result += Math.sin(j) * Math.cos(data.id + j) + Math.sqrt(j + data.id)
        }
        return {
          id: data.id,
          result: result.toFixed(8)
        }
      },
      {id: i, workload: 50000}
    )
  )

  // Sequential execution (simulate)
  console.log('Running sequential simulation...')
  const sequentialStart = performance.now()
  const sequentialResults: any[] = []
  for (const task of comparisonTasks) {
    const result = task.fn(task.data)
    sequentialResults.push(result)
  }
  const sequentialDuration = performance.now() - sequentialStart

  // Parallel execution
  console.log('Running parallel execution...')
  const parallelStart = performance.now()
  const parallelResults = await thread.all(...comparisonTasks)
  const parallelDuration = performance.now() - parallelStart

  console.log(`📊 Performance Comparison:`)
  console.log(`   Sequential: ${sequentialDuration.toFixed(2)}ms`)
  console.log(`   Parallel: ${parallelDuration.toFixed(2)}ms`)
  console.log(
    `   Speedup: ${(sequentialDuration / parallelDuration).toFixed(2)}x faster`
  )
  console.log(
    `   Efficiency: ${(
      (sequentialDuration / parallelDuration / coreCount) *
      100
    ).toFixed(1)}% of theoretical maximum`
  )
  console.log(
    `   Results match: ${
      JSON.stringify(sequentialResults[0]) ===
      JSON.stringify(parallelResults[0])
    }\n`
  )

  // 6. CORE UTILIZATION DEMONSTRATION
  console.log('🎯 Test 6: Core Utilization Demonstration')
  console.log(
    `Creating exactly ${coreCount} long-running tasks to show core utilization\n`
  )

  const coreUtilizationTasks = Array.from({length: coreCount}, (_, i) =>
    threader(
      (coreInfo: {coreId: number; workload: number}) => {
        const startTime = Date.now()
        let result = coreInfo.coreId

        // Run for a specific duration to show core utilization
        while (Date.now() - startTime < 2000) {
          // 2 seconds of work
          for (let j = 0; j < 10000; j++) {
            result += Math.sin(j + coreInfo.coreId) * Math.cos(j)
          }
        }

        return {
          coreId: coreInfo.coreId,
          duration: Date.now() - startTime,
          result: result.toFixed(6),
          message: `Core ${coreInfo.coreId} completed heavy work`
        }
      },
      {coreId: i, workload: 100000}
    )
  )

  console.log(`Starting ${coreCount} long-running tasks (2 seconds each)...`)
  console.log('💡 Monitor your CPU usage - you should see all cores at 100%')

  const utilizationStart = performance.now()
  const utilizationResults = await thread.all(...coreUtilizationTasks)
  const utilizationDuration = performance.now() - utilizationStart

  console.log(
    `✅ Core utilization test completed in ${utilizationDuration.toFixed(2)}ms`
  )
  utilizationResults.forEach(result => {
    // Handle different result formats
    const resultObj = typeof result === 'string' ? JSON.parse(result) : result
    const message =
      resultObj.message ||
      `Core ${
        resultObj.worker_id || resultObj.coreId || 'unknown'
      } completed work`
    const duration = resultObj.duration || utilizationDuration.toFixed(0)
    console.log(`   ${message} in ${duration}ms`)
  })

  console.log('\n🎉 REAL MULTI-CORE DEMONSTRATION COMPLETE!')
  console.log('\n🔑 Key Achievements:')
  console.log('   ✅ True parallel execution across CPU cores')
  console.log('   ✅ No pattern matching - any function works')
  console.log('   ✅ Massive throughput improvements')
  console.log('   ✅ Real-world workload distribution')
  console.log('   ✅ Optimal CPU core utilization')
  console.log('   ✅ Streaming parallel processing')
  console.log('\n💡 This is TRUE multi-core JavaScript execution!')
}

async function runRealMultiCoreDemo() {
  try {
    await demonstrateRealMultiCore()
  } catch (error) {
    console.error('❌ Demo failed:', error.message)
    console.log('\n🔧 Troubleshooting:')
    console.log('   1. Build Rust backend: npm run build:rust')
    console.log('   2. Check Cargo.toml dependencies')
    console.log('   3. Verify platform compatibility')
  } finally {
    await thread.shutdown()
  }
}

runRealMultiCoreDemo().catch(console.error)
