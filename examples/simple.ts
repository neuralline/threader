// examples/simple-parallel-test.ts
// Quick test to verify parallel execution is actually working
import {performance} from 'perf_hooks'
import {threader, thread} from '../src/index'

async function testRealParallelism(): Promise<void> {
  console.log('🧪 SIMPLE PARALLEL EXECUTION TEST')
  console.log('Testing if tasks actually run simultaneously...\n')

  // Create tasks that take different amounts of time
  const tasks = [
    threader(async (delay: number) => {
      const start = Date.now()
      console.log(`  ⏱️  Task 1 starting (${delay}ms delay)`)

      // CPU-intensive work instead of setTimeout
      let result = 0
      const iterations = delay * 1000 // Scale iterations based on delay
      for (let i = 0; i < iterations; i++) {
        result += Math.sin(i) * Math.cos(i)
      }

      const end = Date.now()
      console.log(`  ✅ Task 1 finished after ${end - start}ms`)
      return {taskId: 1, delay, result, actualTime: end - start}
    }, 1000),

    threader(async (delay: number) => {
      const start = Date.now()
      console.log(`  ⏱️  Task 2 starting (${delay}ms delay)`)

      let result = 0
      const iterations = delay * 1000
      for (let i = 0; i < iterations; i++) {
        result += Math.sin(i) * Math.cos(i)
      }

      const end = Date.now()
      console.log(`  ✅ Task 2 finished after ${end - start}ms`)
      return {taskId: 2, delay, result, actualTime: end - start}
    }, 2000),

    threader(async (delay: number) => {
      const start = Date.now()
      console.log(`  ⏱️  Task 3 starting (${delay}ms delay)`)

      let result = 0
      const iterations = delay * 1000
      for (let i = 0; i < iterations; i++) {
        result += Math.sin(i) * Math.cos(i)
      }

      const end = Date.now()
      console.log(`  ✅ Task 3 finished after ${end - start}ms`)
      return {taskId: 3, delay, result, actualTime: end - start}
    }, 3000)
  ]

  console.log('🚀 Starting all tasks with thread.all()...')
  console.log(
    'Expected: All tasks start immediately, finish at different times'
  )
  console.log('Problem: Tasks start one after another (sequential)')
  console.log()

  const startTime = performance.now()
  const results = await thread.all(...tasks)
  const totalTime = performance.now() - startTime

  console.log('\n📊 RESULTS:')
  console.log(`Total execution time: ${totalTime.toFixed(0)}ms`)

  results.forEach((result, index) => {
    console.log(
      `Task ${result.taskId}: took ${result.actualTime}ms (expected ~${result.delay}ms)`
    )
  })

  console.log('\n🔍 DIAGNOSIS:')

  // If truly parallel, total time should be ~3000ms (longest task)
  // If sequential, total time should be ~6000ms (sum of all tasks)

  if (totalTime < 4000) {
    console.log('✅ SUCCESS: Tasks ran in parallel!')
    console.log(
      `   Total time ${totalTime.toFixed(0)}ms ≈ longest task (3000ms)`
    )
    console.log('   All tasks started simultaneously')
  } else if (totalTime > 5500) {
    console.log('❌ PROBLEM: Tasks ran sequentially!')
    console.log(
      `   Total time ${totalTime.toFixed(0)}ms ≈ sum of tasks (6000ms)`
    )
    console.log('   Tasks waited for each other to complete')
  } else {
    console.log('⚠️  PARTIAL: Some parallelism but not optimal')
    console.log(
      `   Total time ${totalTime.toFixed(0)}ms between parallel and sequential`
    )
    console.log('   Check worker pool configuration')
  }
}

async function testStreamingParallelism(): Promise<void> {
  console.log('\n🌊 STREAMING PARALLEL EXECUTION TEST')
  console.log('Testing if streaming shows results as they complete...\n')

  const streamTasks = [
    threader(async (delay: number) => {
      let result = 0
      const iterations = delay * 1000
      for (let i = 0; i < iterations; i++) {
        result += Math.sin(i) * Math.cos(i)
      }
      return {taskId: 'fast', delay, result}
    }, 500), // Should finish first

    threader(async (delay: number) => {
      let result = 0
      const iterations = delay * 1000
      for (let i = 0; i < iterations; i++) {
        result += Math.sin(i) * Math.cos(i)
      }
      return {taskId: 'slow', delay, result}
    }, 2000), // Should finish last

    threader(async (delay: number) => {
      let result = 0
      const iterations = delay * 1000
      for (let i = 0; i < iterations; i++) {
        result += Math.sin(i) * Math.cos(i)
      }
      return {taskId: 'medium', delay, result}
    }, 1000) // Should finish middle
  ]

  console.log('🚀 Starting streaming execution...')
  console.log('Expected order: fast → medium → slow')
  console.log()

  const startTime = performance.now()
  const completionOrder: string[] = []

  for await (const result of thread.stream(...streamTasks)) {
    const elapsed = performance.now() - startTime
    console.log(
      `✅ ${result.result.taskId} task completed at ${elapsed.toFixed(0)}ms`
    )
    completionOrder.push(result.result.taskId)
  }

  console.log('\n📊 STREAMING RESULTS:')
  console.log(`Completion order: ${completionOrder.join(' → ')}`)

  if (completionOrder[0] === 'fast' && completionOrder[2] === 'slow') {
    console.log('✅ SUCCESS: Streaming works correctly!')
    console.log('   Results appeared in completion order')
  } else {
    console.log('❌ PROBLEM: Streaming not working correctly!')
    console.log(
      '   Results should appear as tasks complete, not in input order'
    )
  }
}

async function testBasicParallelMath(): Promise<void> {
  console.log('\n🧮 BASIC PARALLEL MATH TEST')
  console.log('Simple parallel math to verify core functionality...\n')

  // Very simple tasks that should definitely show parallelism
  const mathTasks = [
    threader((n: number) => {
      console.log(`  🔢 Math task ${n} starting...`)
      let result = 0
      for (let i = 0; i < 1000000; i++) {
        result += Math.sin(n * i) * Math.cos(i)
      }
      console.log(`  ✅ Math task ${n} finished`)
      return {task: n, result}
    }, 1),

    threader((n: number) => {
      console.log(`  🔢 Math task ${n} starting...`)
      let result = 0
      for (let i = 0; i < 1000000; i++) {
        result += Math.sin(n * i) * Math.cos(i)
      }
      console.log(`  ✅ Math task ${n} finished`)
      return {task: n, result}
    }, 2),

    threader((n: number) => {
      console.log(`  🔢 Math task ${n} starting...`)
      let result = 0
      for (let i = 0; i < 1000000; i++) {
        result += Math.sin(n * i) * Math.cos(i)
      }
      console.log(`  ✅ Math task ${n} finished`)
      return {task: n, result}
    }, 3)
  ]

  console.log('🚀 Running basic parallel math...')

  const startTime = performance.now()
  const results = await thread.all(...mathTasks)
  const totalTime = performance.now() - startTime

  console.log(`\n📊 Basic math completed in ${totalTime.toFixed(0)}ms`)

  // Check if tasks actually started together by looking at console output timing
  console.log('✅ Check the console output above:')
  console.log('   - If parallel: All "starting" messages appear together')
  console.log('   - If sequential: "starting" and "finished" alternate')
}

async function main(): Promise<void> {
  try {
    await testRealParallelism()
    await testStreamingParallelism()
    await testBasicParallelMath()

    console.log('\n🎯 SUMMARY')
    console.log(
      'If tests show sequential execution, the issue is in your thread implementation.'
    )
    console.log('Tasks should start simultaneously, not wait for each other.')
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  } finally {
    await thread.shutdown()
    console.log('\n✅ Parallel test complete!')
  }
}

main().catch(console.error)
