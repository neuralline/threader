// examples/enhanced-functional-demo.ts
import {thread, threadUtils} from '../src/thread'
import {threader} from '../src/threader'

// ============================================================================
// DEMO: Enhanced Functional Thread Executor
// ============================================================================

async function demoEnhancedThreadExecutor() {
  console.log('🚀 Enhanced Functional Thread Executor Demo\n')

  // Configure the executor
  thread.configure({
    maxWorkers: 4,
    timeout: 5000,
    enableMetrics: true,
    maxMemoryUsage: 100 * 1024 * 1024 // 100MB
  })

  // Create some sample threaders
  const createThreader = (id: number, delay: number) =>
    threader(
      async (data: {id: number; delay: number}) => {
        await new Promise(resolve => setTimeout(resolve, data.delay))
        return `Processed ${data.id} in ${data.delay}ms`
      },
      {id, delay}
    )

  const threaders = [
    createThreader(1, 100),
    createThreader(2, 200),
    createThreader(3, 150),
    createThreader(4, 300),
    createThreader(5, 50)
  ]

  // 1. Basic execution with metrics
  console.log('1️⃣ Basic execution with metrics:')
  try {
    const results = await thread.all(...threaders)
    console.log('Results:', results)

    const stats = thread.getStats()
    console.log('Stats:', stats)
  } catch (error) {
    console.error('Error:', error)
  }

  // 2. Streaming with memory tracking
  console.log('\n2️⃣ Streaming with memory tracking:')
  for await (const result of thread.stream(...threaders)) {
    console.log(`Stream result ${result.index}:`, {
      result: result.result,
      duration: `${result.duration.toFixed(2)}ms`,
      memoryUsage: result.memoryUsage
        ? `${(result.memoryUsage / 1024).toFixed(2)}KB`
        : 'N/A'
    })
  }

  // 3. Race condition
  console.log('\n3️⃣ Race condition:')
  try {
    const winner = await thread.race(...threaders)
    console.log('Winner:', winner)
  } catch (error) {
    console.error('Race error:', error)
  }

  // 4. Get first 3 results
  console.log('\n4️⃣ First 3 results:')
  try {
    const firstThree = await thread.any(3, ...threaders)
    console.log('First 3:', firstThree)
  } catch (error) {
    console.error('Any error:', error)
  }

  // 5. Functional utilities
  console.log('\n5️⃣ Functional utilities:')

  // Batch processing
  const items = Array.from({length: 20}, (_, i) => i)
  const batchResults = await threadUtils.batch(
    items,
    async item => {
      await new Promise(resolve => setTimeout(resolve, 10))
      return item * 2
    },
    5
  )
  console.log('Batch results (first 5):', batchResults.slice(0, 5))

  // Parallel mapping
  const mappedResults = await threadUtils.map(items, async (item, index) => {
    await new Promise(resolve => setTimeout(resolve, 5))
    return `Item ${item} at index ${index}`
  })
  console.log('Mapped results (first 3):', mappedResults.slice(0, 3))

  // Parallel filtering
  const filteredResults = await threadUtils.filter(items, async item => {
    await new Promise(resolve => setTimeout(resolve, 2))
    return item % 2 === 0
  })
  console.log('Filtered results (first 5):', filteredResults.slice(0, 5))

  // 6. Error handling with retry
  console.log('\n6️⃣ Error handling with retry:')

  const failingThreader = threader(
    async (data: {attempt: number}) => {
      if (data.attempt < 2) {
        throw new Error(`Failed on attempt ${data.attempt}`)
      }
      return `Succeeded on attempt ${data.attempt}`
    },
    {attempt: 0}
  )

  try {
    const result = await threadUtils.withRetry(
      async () => {
        const attempts = [0, 1, 2]
        for (const attempt of attempts) {
          try {
            return await failingThreader.fn({attempt})
          } catch (error) {
            if (attempt === attempts.length - 1) throw error
          }
        }
      },
      3,
      100
    )
    console.log('Retry result:', result)
  } catch (error) {
    console.error('Retry failed:', error)
  }

  // 7. Resource monitoring
  console.log('\n7️⃣ Resource monitoring:')
  const finalStats = thread.getStats()
  console.log('Final stats:', {
    activeThreads: finalStats.resources.activeThreads,
    memoryUsage: `${(finalStats.resources.memoryUsage / 1024 / 1024).toFixed(
      2
    )}MB`,
    uptime: `${(finalStats.resources.uptime / 1000).toFixed(2)}s`,
    totalExecutions: finalStats.metrics.totalExecutions,
    successRate: `${(
      (finalStats.metrics.successfulExecutions /
        finalStats.metrics.totalExecutions) *
      100
    ).toFixed(1)}%`,
    averageDuration: `${finalStats.metrics.averageDuration.toFixed(2)}ms`
  })

  // Cleanup
  await thread.shutdown()
  console.log('\n✅ Demo completed successfully!')
}

// Run the demo
if (require.main === module) {
  demoEnhancedThreadExecutor().catch(console.error)
}

export {demoEnhancedThreadExecutor}
