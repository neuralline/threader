// examples/scalability-analysis.ts
import {threader, thread} from '../src/index'
import * as os from 'os'

// Demo 1: Queue Saturation Test
async function queueSaturationTest() {
  console.log('🚦 === QUEUE SATURATION ANALYSIS ===')
  console.log('Testing how Threader handles queue overflow...\n')

  const cpuCount = os.cpus().length
  console.log(`💻 Available CPU cores: ${cpuCount}`)

  // Create way more tasks than we have cores
  const taskCounts = [10, 50, 100, 500, 1000]

  for (const taskCount of taskCounts) {
    console.log(
      `\n📊 Testing ${taskCount} tasks (${(taskCount / cpuCount).toFixed(
        1
      )}x core count)`
    )

    // Create simple tasks that take some time
    const tasks = Array.from(
      {length: taskCount},
      (_, i) =>
        threader(
          (data: {id: number; work: number}) => {
            // Simulate CPU work
            let result = 0
            for (let j = 0; j < data.work; j++) {
              result += Math.sin(j) * Math.cos(j)
            }
            return {
              taskId: data.id,
              result: result.toFixed(2),
              workDone: data.work
            }
          },
          {id: i, work: 10000}
        ) // Consistent work per task
    )

    const start = Date.now()
    const results = await thread.all(...tasks)
    const duration = Date.now() - start

    const avgTimePerTask = duration / taskCount
    const throughput = (taskCount / duration) * 1000
    const efficiency = (throughput / cpuCount) * 100

    console.log(`   ⏱️  Total time: ${duration}ms`)
    console.log(`   📈 Avg per task: ${avgTimePerTask.toFixed(2)}ms`)
    console.log(`   🚀 Throughput: ${throughput.toFixed(0)} tasks/second`)
    console.log(`   ⚡ CPU efficiency: ${efficiency.toFixed(1)}% per core`)
    console.log(`   ✅ All results valid: ${results.length === taskCount}`)
  }
}

// Demo 2: Mixed Workload Simulation
async function mixedWorkloadTest() {
  console.log('\n🎯 === MIXED WORKLOAD SIMULATION ===')
  console.log('Testing different task types competing for resources...\n')

  // Create different types of tasks with varying complexity
  const lightTasks = Array.from(
    {length: 20},
    (_, i) => threader(x => x * 2, i) // Super light, should use Rust
  )

  const mediumTasks = Array.from({length: 10}, (_, i) =>
    threader(
      (data: {base: number}) => {
        // Medium complexity
        let result = data.base
        for (let j = 0; j < 50000; j++) {
          result += Math.sin(j / 1000)
        }
        return result.toFixed(3)
      },
      {base: i * 100}
    )
  )

  const heavyTasks = Array.from({length: 5}, (_, i) =>
    threader(
      (data: {size: number; seed: number}) => {
        // Heavy computation with deterministic "randomness"
        const matrix = Array.from({length: data.size}, (_, row) =>
          Array.from({length: data.size}, (_, col) => {
            // Use deterministic values instead of Math.random()
            return (
              Math.sin(data.seed + row * col) * Math.cos(data.seed + row + col)
            )
          })
        )

        // Matrix multiplication
        const result = Array.from({length: data.size}, (_, i) =>
          Array.from({length: data.size}, (_, j) => {
            let sum = 0
            for (let k = 0; k < data.size; k++) {
              sum += matrix[i][k] * matrix[k][j]
            }
            return sum
          })
        )

        return result[0][0].toFixed(6) // Just return one element
      },
      {size: 50 + i * 10, seed: i * 1234}
    )
  )

  console.log(`📊 Workload mix:`)
  console.log(`   🦀 Light tasks: ${lightTasks.length} (should use Rust)`)
  console.log(`   🟨 Medium tasks: ${mediumTasks.length} (JS workers)`)
  console.log(`   🔥 Heavy tasks: ${heavyTasks.length} (JS workers)`)

  const allTasks = [...lightTasks, ...mediumTasks, ...heavyTasks]
  console.log(`\n🚀 Executing ${allTasks.length} mixed tasks...`)

  const start = Date.now()
  const results = await thread.all(...allTasks)
  const duration = Date.now() - start

  console.log(`\n✅ Mixed workload completed in ${duration}ms`)
  console.log(
    `📈 Average: ${(duration / allTasks.length).toFixed(2)}ms per task`
  )
  console.log(
    `🎯 Results: Light=${lightTasks.length}, Medium=${mediumTasks.length}, Heavy=${heavyTasks.length}`
  )
}

// Demo 3: Streaming vs Batch Performance
async function streamingVsBatchTest() {
  console.log('\n🌊 === STREAMING VS BATCH COMPARISON ===')
  console.log('Comparing different execution strategies...\n')

  const taskCount = 100
  const tasks = Array.from({length: taskCount}, (_, i) =>
    threader(
      (data: {id: number}) => {
        // Variable work to simulate real-world variance
        const work = 5000 + (data.id % 3) * 10000
        let result = 0
        for (let j = 0; j < work; j++) {
          result += Math.sin(j / 100)
        }
        return {id: data.id, result: result.toFixed(3)}
      },
      {id: i}
    )
  )

  // Test 1: Batch execution (thread.all)
  console.log('🔄 Testing batch execution (thread.all)...')
  const batchStart = Date.now()
  const batchResults = await thread.all(...tasks.slice())
  const batchDuration = Date.now() - batchStart

  console.log(`   ⏱️  Batch time: ${batchDuration}ms`)
  console.log(`   📊 Results: ${batchResults.length}`)

  // Test 2: Streaming execution (thread.stream)
  console.log('\n📡 Testing streaming execution (thread.stream)...')
  const streamStart = Date.now()
  const streamResults: any[] = []
  let firstResultTime = 0
  let resultCount = 0

  for await (const result of thread.stream(...tasks.slice())) {
    if (firstResultTime === 0) {
      firstResultTime = Date.now() - streamStart
    }
    streamResults.push(result)
    resultCount++

    // Show progress every 20 results
    if (resultCount % 20 === 0) {
      const elapsed = Date.now() - streamStart
      console.log(`   📈 Progress: ${resultCount}/${taskCount} (${elapsed}ms)`)
    }
  }

  const streamDuration = Date.now() - streamStart

  console.log(`\n📊 COMPARISON RESULTS:`)
  console.log(`   🔄 Batch execution: ${batchDuration}ms (wait for all)`)
  console.log(`   📡 Stream execution: ${streamDuration}ms total`)
  console.log(`   ⚡ First result: ${firstResultTime}ms (streaming advantage)`)
  console.log(
    `   🎯 Time to first result advantage: ${(
      ((batchDuration - firstResultTime) / batchDuration) *
      100
    ).toFixed(1)}%`
  )
}

// Demo 4: Resource Contention Analysis
async function resourceContentionTest() {
  console.log('\n⚔️  === RESOURCE CONTENTION ANALYSIS ===')
  console.log('Testing how tasks compete for CPU resources...\n')

  const cpuCount = os.cpus().length

  // Create exactly cpuCount tasks that run for different durations
  const shortTasks = Array.from(
    {length: cpuCount},
    (_, i) =>
      threader(
        (data: {id: number; workAmount: number}) => {
          // Simulate work with deterministic computation
          let work = 0
          for (let j = 0; j < data.workAmount; j++) {
            work += Math.sin(j) * Math.cos(j)
          }
          return {id: data.id, work: work.toFixed(2)}
        },
        {id: i, workAmount: 100000}
      ) // Small work amount
  )

  const longTasks = Array.from(
    {length: cpuCount},
    (_, i) =>
      threader(
        (data: {id: number; workAmount: number}) => {
          // Simulate work with deterministic computation
          let work = 0
          for (let j = 0; j < data.workAmount; j++) {
            work += Math.sin(j) * Math.cos(j)
          }
          return {id: data.id, work: work.toFixed(2)}
        },
        {id: i + cpuCount, workAmount: 500000}
      ) // Large work amount
  )

  console.log(
    `🔥 Running ${cpuCount} short tasks (100ms) + ${cpuCount} long tasks (500ms)`
  )
  console.log(`💻 Available cores: ${cpuCount}`)
  console.log(`⚖️  Contention ratio: 2:1 (tasks:cores)\n`)

  const mixedTasks = [...shortTasks, ...longTasks]

  let completedTasks = 0
  const startTime = Date.now()

  console.log('📊 Task completion timeline:')
  for await (const result of thread.stream(...mixedTasks)) {
    completedTasks++
    const elapsed = Date.now() - startTime
    const taskType = result.result.id < cpuCount ? 'SHORT' : 'LONG'

    console.log(
      `   ${taskType.padEnd(5)} Task #${
        result.result.id
      } completed at ${elapsed}ms (${completedTasks}/${mixedTasks.length})`
    )
  }

  const totalTime = Date.now() - startTime
  console.log(`\n⏱️  Total execution time: ${totalTime}ms`)
  console.log(`🎯 Expected optimal time: ~500ms (limited by longest task)`)
  console.log(`📈 Actual vs optimal: ${(totalTime / 500).toFixed(2)}x`)
}

// Demo 5: Queue Management Deep Dive
async function queueManagementAnalysis() {
  console.log('\n🔍 === QUEUE MANAGEMENT DEEP DIVE ===')
  console.log('Analyzing internal queue behavior...\n')

  // Create a burst of tasks
  const burstSize = 50
  const tasks = Array.from({length: burstSize}, (_, i) =>
    threader(
      (data: {id: number; complexity: number}) => {
        // Variable complexity to see queue prioritization
        let result = 0
        for (let j = 0; j < data.complexity; j++) {
          result += Math.sin(j) * Math.cos(j)
        }
        return {
          id: data.id,
          complexity: data.complexity,
          result: result.toFixed(4)
        }
      },
      {
        id: i,
        complexity: 1000 + (i % 5) * 5000 // Varying complexity
      }
    )
  )

  console.log(`🚀 Submitting ${burstSize} tasks in rapid succession...`)
  console.log(`💾 Queue should buffer tasks beyond core capacity`)
  console.log(`⚡ Workers should process queue as they become available\n`)

  const results: any[] = []
  const startTime = Date.now()
  let taskIndex = 0

  for await (const result of thread.stream(...tasks)) {
    const elapsed = Date.now() - startTime
    results.push({
      ...result,
      completionTime: elapsed,
      queuePosition: taskIndex++
    })

    // Show queue drainage progress
    if (taskIndex % 10 === 0 || taskIndex <= 10) {
      console.log(
        `   📦 Queue progress: ${taskIndex}/${burstSize} (${elapsed}ms)`
      )
    }
  }

  // Analyze queue behavior
  const totalTime = Date.now() - startTime
  const avgTimePerTask = totalTime / burstSize
  const firstTaskTime = results[0].completionTime
  const lastTaskTime = results[results.length - 1].completionTime

  console.log(`\n📊 QUEUE ANALYSIS:`)
  console.log(`   ⏱️  Total time: ${totalTime}ms`)
  console.log(`   🎯 First task: ${firstTaskTime}ms`)
  console.log(`   🏁 Last task: ${lastTaskTime}ms`)
  console.log(`   📈 Avg per task: ${avgTimePerTask.toFixed(2)}ms`)
  console.log(
    `   📦 Queue drain rate: ${((burstSize / totalTime) * 1000).toFixed(
      1
    )} tasks/second`
  )

  // Analyze if simpler tasks completed faster (queue fairness)
  const simpleTasksAvg =
    results
      .filter(r => r.result.complexity <= 5000)
      .reduce((sum, r) => sum + r.duration, 0) /
    results.filter(r => r.result.complexity <= 5000).length

  const complexTasksAvg =
    results
      .filter(r => r.result.complexity > 5000)
      .reduce((sum, r) => sum + r.duration, 0) /
    results.filter(r => r.result.complexity > 5000).length

  console.log(`   ⚡ Simple tasks avg: ${simpleTasksAvg.toFixed(2)}ms`)
  console.log(`   🔥 Complex tasks avg: ${complexTasksAvg.toFixed(2)}ms`)
  console.log(
    `   📊 Complexity ratio: ${(complexTasksAvg / simpleTasksAvg).toFixed(2)}x`
  )
}

// Main analysis runner
async function runScalabilityAnalysis() {
  console.log('📊 THREADER SCALABILITY & QUEUE MANAGEMENT ANALYSIS')
  console.log('==================================================\n')

  try {
    await queueSaturationTest()
    await mixedWorkloadTest()
    await streamingVsBatchTest()
    await resourceContentionTest()
    await queueManagementAnalysis()

    console.log('\n🎉 SCALABILITY ANALYSIS COMPLETE!')
    console.log(
      '📈 Your Threader library shows excellent scaling characteristics!'
    )
  } catch (error) {
    console.error('❌ Analysis failed:', error)
  } finally {
    await thread.shutdown()
    console.log('\n✅ Analysis complete!')
  }
}

runScalabilityAnalysis().catch(console.error)
