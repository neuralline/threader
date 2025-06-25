// examples/concurrent-usage-test.ts - COMPLETELY FIXED VERSION
// Test what happens when multiple thread operations run simultaneously
import {performance} from 'perf_hooks'
import {threader, thread} from '../src/index'

async function testConcurrentUsage(): Promise<void> {
  console.log('🧪 CONCURRENT THREAD USAGE TEST')
  console.log(
    'Testing multiple thread.all() and thread.stream() simultaneously'
  )
  console.log('='.repeat(70)) // FIXED: Use .repeat() instead of *

  // Create different types of work - FIXED: Proper function definitions
  const createHeavyWork = (id: string, duration: number) =>
    threader(
      (data: {id: string; workAmount: number}) => {
        const startTime = Date.now()
        let result = 0

        // CPU-intensive work that takes approximately 'duration' ms
        const iterations = data.workAmount * 1000
        for (let i = 0; i < iterations; i++) {
          result += Math.sin(i) * Math.cos(i) + Math.sqrt(i)
        }

        const actualDuration = Date.now() - startTime
        return {
          id: data.id,
          result: result.toFixed(4),
          requestedDuration: data.workAmount,
          actualDuration,
          completed: true
        }
      },
      {id, workAmount: duration}
    )

  console.log('\n🔥 Test 1: Sequential Usage (Baseline)')
  console.log('Running operations one after another...')

  const sequentialStart = performance.now()

  // Sequential execution
  console.log('🔄 Running thread.all() #1...')
  const seq1Start = performance.now()
  const seq1 = await thread.all(
    createHeavyWork('seq1-1', 100),
    createHeavyWork('seq1-2', 150),
    createHeavyWork('seq1-3', 200)
  )
  const seq1Time = performance.now() - seq1Start
  console.log(`   ✅ Completed in ${seq1Time.toFixed(0)}ms`)

  console.log('🌊 Running thread.stream()...')
  const streamStart = performance.now()
  const streamResults = []
  for await (const result of thread.stream(
    createHeavyWork('stream-1', 80),
    createHeavyWork('stream-2', 120),
    createHeavyWork('stream-3', 160)
  )) {
    streamResults.push(result.result)
  }
  const streamTime = performance.now() - streamStart
  console.log(`   ✅ Completed in ${streamTime.toFixed(0)}ms`)

  console.log('🔄 Running thread.all() #2...')
  const seq2Start = performance.now()
  const seq2 = await thread.all(
    createHeavyWork('seq2-1', 90),
    createHeavyWork('seq2-2', 130),
    createHeavyWork('seq2-3', 170)
  )
  const seq2Time = performance.now() - seq2Start
  console.log(`   ✅ Completed in ${seq2Time.toFixed(0)}ms`)

  const sequentialTotal = performance.now() - sequentialStart
  console.log(`📊 Sequential total: ${sequentialTotal.toFixed(0)}ms`)

  // ============================================================================

  console.log('\n⚡ Test 2: Concurrent Usage (The Real Test)')
  console.log('Running all operations simultaneously...')

  const concurrentStart = performance.now()

  // Launch all operations simultaneously
  console.log('🚀 Launching all operations at once...')

  try {
    const [concurrent1, concurrentStream, concurrent2] = await Promise.all([
      // First thread.all()
      (async () => {
        const start = performance.now()
        console.log('   🔄 thread.all() #1 starting...')
        const result = await thread.all(
          createHeavyWork('conc1-1', 100),
          createHeavyWork('conc1-2', 150),
          createHeavyWork('conc1-3', 200)
        )
        const duration = performance.now() - start
        console.log(
          `   ✅ thread.all() #1 completed in ${duration.toFixed(0)}ms`
        )
        return {type: 'all1', result, duration}
      })(),

      // thread.stream()
      (async () => {
        const start = performance.now()
        console.log('   🌊 thread.stream() starting...')
        const streamResults = []
        let resultCount = 0

        for await (const result of thread.stream(
          createHeavyWork('conc-stream-1', 80),
          createHeavyWork('conc-stream-2', 120),
          createHeavyWork('conc-stream-3', 160)
        )) {
          resultCount++
          console.log(`   📡 Stream result ${resultCount}: ${result.result.id}`)
          streamResults.push(result.result)
        }

        const duration = performance.now() - start
        console.log(
          `   ✅ thread.stream() completed in ${duration.toFixed(0)}ms`
        )
        return {type: 'stream', result: streamResults, duration}
      })(),

      // Second thread.all()
      (async () => {
        const start = performance.now()
        console.log('   🔄 thread.all() #2 starting...')
        const result = await thread.all(
          createHeavyWork('conc2-1', 90),
          createHeavyWork('conc2-2', 130),
          createHeavyWork('conc2-3', 170)
        )
        const duration = performance.now() - start
        console.log(
          `   ✅ thread.all() #2 completed in ${duration.toFixed(0)}ms`
        )
        return {type: 'all2', result, duration}
      })()
    ])

    const concurrentTotal = performance.now() - concurrentStart

    console.log('\n📊 CONCURRENT USAGE RESULTS:')
    console.log(`🔄 thread.all() #1: ${concurrent1.duration.toFixed(0)}ms`)
    console.log(
      `🌊 thread.stream():  ${concurrentStream.duration.toFixed(0)}ms`
    )
    console.log(`🔄 thread.all() #2: ${concurrent2.duration.toFixed(0)}ms`)
    console.log(`⏱️  Total concurrent: ${concurrentTotal.toFixed(0)}ms`)
    console.log(`📈 vs Sequential:   ${sequentialTotal.toFixed(0)}ms`)

    const speedup = sequentialTotal / concurrentTotal
    console.log(`🚀 Concurrency speedup: ${speedup.toFixed(1)}x faster`)

    // ============================================================================

    console.log('\n🔍 Test 3: Resource Contention Analysis')
    console.log('Testing heavy concurrent load to see resource limits...')

    const heavyStart = performance.now()

    // Create very heavy concurrent load
    const heavyOperations = await Promise.all([
      // Heavy thread.all() with many tasks
      (async () => {
        const start = performance.now()
        const heavyTasks = Array.from({length: 10}, (_, i) =>
          createHeavyWork(`heavy-all-${i}`, 50)
        )
        const result = await thread.all(...heavyTasks)
        return {
          type: 'heavy-all',
          duration: performance.now() - start,
          count: 10
        }
      })(),

      // Heavy thread.stream() with many tasks
      (async () => {
        const start = performance.now()
        const heavyTasks = Array.from({length: 10}, (_, i) =>
          createHeavyWork(`heavy-stream-${i}`, 50)
        )

        let resultCount = 0
        for await (const result of thread.stream(...heavyTasks)) {
          resultCount++
        }

        return {
          type: 'heavy-stream',
          duration: performance.now() - start,
          count: resultCount
        }
      })(),

      // Another heavy thread.all()
      (async () => {
        const start = performance.now()
        const heavyTasks = Array.from({length: 10}, (_, i) =>
          createHeavyWork(`heavy-all2-${i}`, 50)
        )
        const result = await thread.all(...heavyTasks)
        return {
          type: 'heavy-all2',
          duration: performance.now() - start,
          count: 10
        }
      })()
    ])

    const heavyTotal = performance.now() - heavyStart

    console.log('\n📊 HEAVY LOAD RESULTS:')
    heavyOperations.forEach(op => {
      console.log(`${op.type}: ${op.duration.toFixed(0)}ms (${op.count} tasks)`)
    })
    console.log(`⏱️  Total time: ${heavyTotal.toFixed(0)}ms`)
    console.log(`📊 Total tasks: 30 tasks across 3 concurrent operations`)
    console.log(`🔄 Avg per task: ${(heavyTotal / 30).toFixed(1)}ms`)

    // Calculate theoretical vs actual performance
    const theoreticalTime = 50 * 30 // If all tasks ran sequentially
    const actualTime = heavyTotal
    const parallelEfficiency = (theoreticalTime / actualTime / 8) * 100 // Assuming 8 cores

    console.log(`\n📈 PARALLEL EFFICIENCY ANALYSIS:`)
    console.log(`🔢 Theoretical sequential: ${theoreticalTime}ms`)
    console.log(`⚡ Actual parallel: ${actualTime.toFixed(0)}ms`)
    console.log(
      `🎯 Parallelization efficiency: ${parallelEfficiency.toFixed(1)}%`
    )

    if (parallelEfficiency > 70) {
      console.log('✅ EXCELLENT: High parallel efficiency')
    } else if (parallelEfficiency > 50) {
      console.log('✅ GOOD: Decent parallel efficiency')
    } else if (parallelEfficiency > 30) {
      console.log('⚠️ MODERATE: Some resource contention')
    } else {
      console.log('❌ POOR: Significant resource contention')
    }

    // ============================================================================

    console.log('\n🎯 Test 4: Mixed Operation Patterns')
    console.log('Testing realistic mixed usage patterns...')

    // Simulate realistic application usage
    const mixedStart = performance.now()

    const mixedResults = await Promise.all([
      // Background batch processing
      thread.all(
        createHeavyWork('batch-1', 200),
        createHeavyWork('batch-2', 200),
        createHeavyWork('batch-3', 200)
      ),

      // Real-time stream processing
      (async () => {
        const results = []
        for await (const result of thread.stream(
          createHeavyWork('realtime-1', 50),
          createHeavyWork('realtime-2', 75),
          createHeavyWork('realtime-3', 100),
          createHeavyWork('realtime-4', 125),
          createHeavyWork('realtime-5', 150)
        )) {
          results.push(result.result)
        }
        return results
      })(),

      // API request processing
      thread.all(
        createHeavyWork('api-1', 80),
        createHeavyWork('api-2', 90),
        createHeavyWork('api-3', 100)
      )
    ])

    const mixedTotal = performance.now() - mixedStart

    console.log(`📊 Mixed usage completed in ${mixedTotal.toFixed(0)}ms`)
    console.log(`🔄 Background batch: ${mixedResults[0].length} tasks`)
    console.log(`🌊 Real-time stream: ${mixedResults[1].length} tasks`)
    console.log(`⚡ API requests: ${mixedResults[2].length} tasks`)
    console.log(
      `📈 Total tasks: ${
        mixedResults[0].length + mixedResults[1].length + mixedResults[2].length
      }`
    )
  } catch (error) {
    console.error('❌ Concurrent operations failed:', error.message)
    throw error
  }
}

async function testResourceSharing(): Promise<void> {
  console.log('\n🔧 RESOURCE SHARING ANALYSIS')
  console.log('Understanding how workers are shared between operations...')

  // Test if operations block each other or run truly concurrently
  const sharingStart = performance.now()

  console.log('\n🧪 Quick concurrency test:')
  console.log(
    'If operations block each other, total time ≈ sum of individual times'
  )
  console.log('If truly concurrent, total time ≈ max of individual times')

  const [fastOp, mediumOp, slowOp] = await Promise.all([
    // Fast operation
    (async () => {
      const start = performance.now()
      await thread.all(
        threader(
          (data: {id: string; workAmount: number}) => {
            const startTime = Date.now()
            let result = 0
            const iterations = data.workAmount * 1000
            for (let i = 0; i < iterations; i++) {
              result += Math.sin(i) * Math.cos(i) + Math.sqrt(i)
            }
            return {
              id: data.id,
              result: result.toFixed(4),
              actualDuration: Date.now() - startTime,
              completed: true
            }
          },
          {id: 'fast', workAmount: 50}
        )
      )
      return performance.now() - start
    })(),

    // Medium operation
    (async () => {
      const start = performance.now()
      await thread.all(
        threader(
          (data: {id: string; workAmount: number}) => {
            const startTime = Date.now()
            let result = 0
            const iterations = data.workAmount * 1000
            for (let i = 0; i < iterations; i++) {
              result += Math.sin(i) * Math.cos(i) + Math.sqrt(i)
            }
            return {
              id: data.id,
              result: result.toFixed(4),
              actualDuration: Date.now() - startTime,
              completed: true
            }
          },
          {id: 'medium', workAmount: 100}
        )
      )
      return performance.now() - start
    })(),

    // Slow operation
    (async () => {
      const start = performance.now()
      await thread.all(
        threader(
          (data: {id: string; workAmount: number}) => {
            const startTime = Date.now()
            let result = 0
            const iterations = data.workAmount * 1000
            for (let i = 0; i < iterations; i++) {
              result += Math.sin(i) * Math.cos(i) + Math.sqrt(i)
            }
            return {
              id: data.id,
              result: result.toFixed(4),
              actualDuration: Date.now() - startTime,
              completed: true
            }
          },
          {id: 'slow', workAmount: 150}
        )
      )
      return performance.now() - start
    })()
  ])

  const totalConcurrent = performance.now() - sharingStart
  const sumOfOperations = fastOp + mediumOp + slowOp
  const maxOfOperations = Math.max(fastOp, mediumOp, slowOp)

  console.log(`⚡ Fast operation: ${fastOp.toFixed(0)}ms`)
  console.log(`⚙️  Medium operation: ${mediumOp.toFixed(0)}ms`)
  console.log(`🐌 Slow operation: ${slowOp.toFixed(0)}ms`)
  console.log(`📊 Total concurrent: ${totalConcurrent.toFixed(0)}ms`)
  console.log(`🔢 Sum if blocking: ${sumOfOperations.toFixed(0)}ms`)
  console.log(`🎯 Max if parallel: ${maxOfOperations.toFixed(0)}ms`)

  const concurrencyRatio = totalConcurrent / maxOfOperations

  if (concurrencyRatio < 1.3) {
    console.log('✅ EXCELLENT: Operations run truly in parallel')
  } else if (concurrencyRatio < 2.0) {
    console.log('✅ GOOD: Mostly parallel with some overhead')
  } else if (concurrencyRatio < 3.0) {
    console.log('⚠️ MODERATE: Some blocking between operations')
  } else {
    console.log('❌ POOR: Operations appear to block each other')
  }
}

async function main(): Promise<void> {
  try {
    await testConcurrentUsage()
    await testResourceSharing()

    console.log('\n🎉 CONCURRENT USAGE TEST COMPLETE!')
    console.log('\n🔑 KEY INSIGHTS:')
    console.log('📊 This test reveals how well Threader handles multiple')
    console.log('   simultaneous operations and worker pool efficiency.')
  } catch (error) {
    console.error('❌ Concurrent usage test failed:', error.message)
    console.error('Stack trace:', error.stack)
  } finally {
    await thread.shutdown()
    console.log('\n✅ Concurrent usage test complete!')
  }
}

main().catch(console.error)
