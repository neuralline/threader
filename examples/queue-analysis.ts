// examples/queue-analysis.ts

/**
 * ANALYSIS OF CURRENT THREADER QUEUE IMPLEMENTATION
 *
 * Looking at the WorkerManager class, here's how queuing currently works:
 */

console.log(`
    🔍 CURRENT THREADER QUEUE ANALYSIS
    ==================================
    
    📋 Current Implementation Analysis:
    
    1. **Worker Pool Architecture**:
       - Fixed pool size = CPU core count (8 cores on your machine)
       - Workers are pre-initialized and reused
       - Single task queue (FIFO - First In, First Out)
    
    2. **Queue Management**:
       - All tasks go into single 'taskQueue' array
       - 'processQueue()' runs when workers become available
       - No task prioritization or load balancing
    
    3. **Task Distribution**:
       - Simple round-robin: next available worker gets next task
       - No consideration of task complexity or estimated duration
       - No work-stealing between workers
    
    4. **Bottlenecks Identified**:
       ❌ Single queue can become bottleneck with high task volume
       ❌ No load balancing - one heavy task can block others
       ❌ FIFO may not be optimal for mixed workloads
       ❌ No task prioritization system
    
    5. **Scaling Characteristics**:
       ✅ Good: Fixed overhead regardless of task count
       ✅ Good: Efficient worker reuse
       ⚠️  Limited: Single-threaded queue management
       ⚠️  Limited: No dynamic scaling
    
    POTENTIAL IMPROVEMENTS:
    =======================
    
    🚀 **Multiple Priority Queues**:
       - High/Medium/Low priority queues
       - Smart task classification
       - Priority-based scheduling
    
    ⚖️  **Load Balancing**:
       - Track worker load/utilization
       - Distribute based on estimated task complexity
       - Work-stealing when workers idle
    
    📊 **Queue Sharding**:
       - Multiple queues per worker group
       - Reduce contention on single queue
       - Better cache locality
    
    🎯 **Adaptive Scaling**:
       - Dynamic worker pool sizing
       - Burst capacity for high loads
       - Graceful degradation under pressure
    
    Let's test these theories with real workloads...
    `)

import {threader, thread} from '../src/index'

// Test current queue behavior under stress
async function stressTestCurrentQueue() {
  console.log('\n🔥 STRESS TESTING CURRENT QUEUE IMPLEMENTATION\n')

  // Scenario 1: Queue flooding
  console.log('📊 Scenario 1: Queue Flooding (1000 tasks at once)')
  const floodTasks = Array.from(
    {length: 1000},
    (_, i) => threader(x => x * 2, i) // Super simple tasks
  )

  const floodStart = Date.now()
  await thread.all(...floodTasks)
  const floodTime = Date.now() - floodStart

  console.log(`   Result: ${floodTime}ms for 1000 simple tasks`)
  console.log(`   Rate: ${((1000 / floodTime) * 1000).toFixed(0)} tasks/second`)
  console.log(`   Per task: ${(floodTime / 1000).toFixed(2)}ms average\n`)

  // Scenario 2: Mixed load with blocking tasks
  console.log('📊 Scenario 2: Mixed Load with Blocking Tasks')
  const blockingTasks = [
    // One very heavy task that will block a worker
    threader((size: number) => {
      let result = 0
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          result += Math.sin(i) * Math.cos(j)
        }
      }
      return result
    }, 1000), // Heavy computation

    // Many light tasks that should complete quickly
    ...Array.from({length: 20}, (_, i) => threader(x => x * 2, i))
  ]

  console.log('   🐌 1 heavy task + 20 light tasks')
  const mixedStart = Date.now()
  let completed = 0

  for await (const result of thread.stream(...blockingTasks)) {
    completed++
    const elapsed = Date.now() - mixedStart
    const isHeavyTask = result.index === 0
    console.log(
      `   ${isHeavyTask ? '🔥' : '⚡'} Task ${
        result.index
      } done at ${elapsed}ms`
    )
  }

  const mixedTime = Date.now() - mixedStart
  console.log(`   Total time: ${mixedTime}ms\n`)

  // Scenario 3: Queue saturation point
  console.log('📊 Scenario 3: Finding Queue Saturation Point')
  const taskCounts = [10, 50, 100, 500, 1000, 2000]

  for (const count of taskCounts) {
    const saturationTasks = Array.from({length: count}, (_, i) =>
      threader((data: number) => {
        // Small amount of work to isolate queue overhead
        let result = 0
        for (let j = 0; j < 1000; j++) {
          result += Math.sin(data + j)
        }
        return result
      }, i)
    )

    const satStart = Date.now()
    await thread.all(...saturationTasks)
    const satTime = Date.now() - satStart

    const tasksPerSecond = (count / satTime) * 1000
    const avgPerTask = satTime / count

    console.log(
      `   ${count.toString().padStart(4)} tasks: ${satTime
        .toString()
        .padStart(4)}ms | ${tasksPerSecond
        .toFixed(0)
        .padStart(5)} tasks/sec | ${avgPerTask.toFixed(2)}ms avg`
    )
  }
}

stressTestCurrentQueue()
  .then(() => {
    console.log('\n✅ Queue stress testing complete!')
    thread.shutdown()
  })
  .catch(console.error)
