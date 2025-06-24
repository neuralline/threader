// test/realistic-stream-test.ts - Test with realistic timing differences
import {performance} from 'perf_hooks'
import {threader, thread} from '../src/index'

/**
 * Create tasks with realistic timing differences using setTimeout
 */
const createVariableTimingTasks = () => [
  // Fast task - 100ms
  threader(async (data: string) => {
    await new Promise(resolve => setTimeout(resolve, 100))
    return `${data}: completed in 100ms`
  }, 'fast-task'),

  // Very slow task - 2000ms
  threader(async (data: string) => {
    await new Promise(resolve => setTimeout(resolve, 2000))
    return `${data}: completed in 2000ms`
  }, 'very-slow-task'),

  // Medium task - 500ms
  threader(async (data: string) => {
    await new Promise(resolve => setTimeout(resolve, 500))
    return `${data}: completed in 500ms`
  }, 'medium-task'),

  // Slow task - 1500ms
  threader(async (data: string) => {
    await new Promise(resolve => setTimeout(resolve, 1500))
    return `${data}: completed in 1500ms`
  }, 'slow-task'),

  // Very fast task - 50ms
  threader(async (data: string) => {
    await new Promise(resolve => setTimeout(resolve, 50))
    return `${data}: completed in 50ms`
  }, 'very-fast-task')
]

/**
 * Test stream showing results in completion order
 */
async function testStreamOrdering() {
  console.log('🌊 Testing Stream Completion Order')
  console.log(
    'Expected order: very-fast(50ms) → fast(100ms) → medium(500ms) → slow(1500ms) → very-slow(2000ms)'
  )
  console.log('=' * 80)

  const tasks = createVariableTimingTasks()
  const startTime = performance.now()

  console.log('🚀 Starting all tasks simultaneously...\n')

  let resultCount = 0
  for await (const result of thread.stream(...tasks)) {
    resultCount++
    const elapsed = performance.now() - startTime

    console.log(
      `✅ [${resultCount}/5] ${result.result} | Index: ${
        result.index
      } | Elapsed: ${elapsed.toFixed(0)}ms`
    )

    // This should show results in completion order, not input order!
    if (resultCount === 1 && elapsed < 80) {
      console.log('   🎯 PERFECT: Got first result quickly!')
    }
  }

  const totalTime = performance.now() - startTime
  console.log(`\n⏱️  Total stream time: ${totalTime.toFixed(0)}ms`)
  console.log(
    '💡 Notice: Results should appear in completion order (by timing), not input order!\n'
  )
}

/**
 * Compare all vs stream with clear timing differences
 */
async function compareWithClearTimings() {
  console.log('📊 All vs Stream with Clear Timing Differences')
  console.log('=' * 50)

  const tasks1 = createVariableTimingTasks()
  const tasks2 = createVariableTimingTasks()

  // Test thread.all
  console.log('🔄 Testing thread.all (wait for everything):')
  const allStart = performance.now()
  const allResults = await thread.all(...tasks1)
  const allTime = performance.now() - allStart

  console.log(`   ⏳ Waited ${allTime.toFixed(0)}ms for ALL results`)
  console.log(`   📦 Got ${allResults.length} results all at once`)
  console.log(
    `   😴 User waited ${allTime.toFixed(0)}ms before seeing ANYTHING\n`
  )

  // Test thread.stream
  console.log('🌊 Testing thread.stream (progressive results):')
  const streamStart = performance.now()
  const streamResults: any[] = []
  const streamTimes: number[] = []

  for await (const result of thread.stream(...tasks2)) {
    const elapsed = performance.now() - streamStart
    streamResults.push(result.result)
    streamTimes.push(elapsed)

    console.log(
      `   ⚡ Result ${streamResults.length}: ${
        result.result
      } | ${elapsed.toFixed(0)}ms`
    )
  }

  const streamTotalTime = performance.now() - streamStart

  console.log(`\n📈 Stream Analysis:`)
  console.log(`   ⚡ First result: ${streamTimes[0].toFixed(0)}ms`)
  console.log(`   ⏱️  Total time: ${streamTotalTime.toFixed(0)}ms`)
  console.log(
    `   🎯 Time to first result: ${(
      ((allTime - streamTimes[0]) / allTime) *
      100
    ).toFixed(0)}% faster`
  )
  console.log(
    `   💡 User saw results ${(allTime / streamTimes[0]).toFixed(1)}x sooner!`
  )
}

/**
 * Real-world scenario: Mixed API calls
 */
async function realWorldMixedAPIs() {
  console.log('\n🌐 Real-World: Mixed API Response Times')
  console.log('=' * 45)

  const apiTasks = [
    // Cache hit - super fast
    threader(async (endpoint: string) => {
      await new Promise(resolve => setTimeout(resolve, 25))
      return {
        endpoint,
        source: 'cache',
        data: 'user_profile_cached',
        responseTime: 25
      }
    }, 'GET /api/user/profile'),

    // Database query - slow
    threader(async (endpoint: string) => {
      await new Promise(resolve => setTimeout(resolve, 1800))
      return {
        endpoint,
        source: 'database',
        data: 'analytics_data',
        responseTime: 1800
      }
    }, 'GET /api/analytics/report'),

    // External API - medium
    threader(async (endpoint: string) => {
      await new Promise(resolve => setTimeout(resolve, 300))
      return {
        endpoint,
        source: 'external_api',
        data: 'weather_data',
        responseTime: 300
      }
    }, 'GET /api/weather/current'),

    // ML service - very slow
    threader(async (endpoint: string) => {
      await new Promise(resolve => setTimeout(resolve, 2500))
      return {
        endpoint,
        source: 'ml_service',
        data: 'recommendations',
        responseTime: 2500
      }
    }, 'POST /api/ml/recommend')
  ]

  console.log('🚀 Making 4 API calls simultaneously...')
  console.log('   📦 Cache: ~25ms')
  console.log('   🌤️  Weather: ~300ms')
  console.log('   📊 Analytics: ~1800ms')
  console.log('   🤖 ML: ~2500ms\n')

  const startTime = performance.now()
  let responseCount = 0

  for await (const result of thread.stream(...apiTasks)) {
    responseCount++
    const elapsed = performance.now() - startTime
    const api = result.result

    console.log(`📡 [${responseCount}/4] ${api.endpoint}`)
    console.log(
      `   ⚡ Source: ${api.source} | Response: ${
        api.responseTime
      }ms | Total: ${elapsed.toFixed(0)}ms`
    )

    // Show immediate user value
    switch (api.source) {
      case 'cache':
        console.log(`   🎯 UI UPDATE: User profile loaded instantly!`)
        break
      case 'external_api':
        console.log(`   🎯 UI UPDATE: Weather widget updated!`)
        break
      case 'database':
        console.log(`   🎯 UI UPDATE: Analytics dashboard populated!`)
        break
      case 'ml_service':
        console.log(`   🎯 UI UPDATE: Personalized recommendations ready!`)
        break
    }
    console.log()
  }

  const totalTime = performance.now() - startTime
  console.log(`🏁 All APIs completed in ${totalTime.toFixed(0)}ms`)
  console.log(
    `💡 User experienced progressive loading instead of ${totalTime.toFixed(
      0
    )}ms blank screen!`
  )
}

/**
 * Demonstrate why results don't appear in order
 */
async function explainResultOrdering() {
  console.log('\n🎓 Understanding Result Ordering')
  console.log('=' * 35)

  console.log('📝 Tasks created in this order:')
  console.log('   [0] 100ms task')
  console.log('   [1] 2000ms task')
  console.log('   [2] 500ms task')
  console.log('   [3] 1500ms task')
  console.log('   [4] 50ms task\n')

  console.log('⏰ Expected completion order (by timing):')
  console.log('   [4] 50ms   ← fastest')
  console.log('   [0] 100ms')
  console.log('   [2] 500ms')
  console.log('   [3] 1500ms')
  console.log('   [1] 2000ms ← slowest\n')

  const tasks = createVariableTimingTasks()
  const actualOrder: number[] = []

  console.log('🌊 Actual stream results:')
  for await (const result of thread.stream(...tasks)) {
    actualOrder.push(result.index)
    console.log(`   [${result.index}] completed: ${result.result}`)
  }

  console.log(`\n📊 Actual order: [${actualOrder.join(', ')}]`)

  const expectedOrder = [4, 0, 2, 3, 1]
  const isCorrectOrder = actualOrder.join(',') === expectedOrder.join(',')

  if (isCorrectOrder) {
    console.log('✅ PERFECT: Results streamed in completion order!')
  } else {
    console.log('❌ ISSUE: Results not in expected completion order')
    console.log(`   Expected: [${expectedOrder.join(', ')}]`)
    console.log(`   Actual:   [${actualOrder.join(', ')}]`)
  }
}

/**
 * Main test runner
 */
export async function runRealisticStreamTest(): Promise<void> {
  console.log('🧪 Realistic Stream vs All Test with Variable Timing')
  console.log('=' * 60)

  try {
    await testStreamOrdering()
    await compareWithClearTimings()
    await realWorldMixedAPIs()
    await explainResultOrdering()

    console.log('\n🎯 KEY TAKEAWAYS:')
    console.log('=' * 30)
    console.log('⚡ Stream provides IMMEDIATE feedback from fast tasks')
    console.log('🎮 Much better UX - progressive loading vs blank screen')
    console.log('📊 Results appear in COMPLETION order, not input order')
    console.log('🚀 Perfect for real-time dashboards and API aggregation')
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.error(error.stack)
  } finally {
    await thread.shutdown()
    console.log('\n✅ Realistic stream test completed!')
  }
}

// CLI runner
runRealisticStreamTest()
