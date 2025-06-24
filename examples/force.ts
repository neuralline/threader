// test/force-js-stream-test.ts - Force JS execution to test true streaming
import {performance} from 'perf_hooks'
import {threader, thread} from '../src/index'

/**
 * Create tasks that MUST use JavaScript workers (complex patterns Rust can't handle)
 */
const createComplexTasks = () => [
  // Task 0: Fast complex operation (100ms)
  threader(
    (data: any) => {
      return new Promise(resolve => {
        setTimeout(() => {
          const result = data.items.reduce(
            (acc: number, item: any) => acc + item.value,
            0
          )
          resolve({
            taskId: 0,
            timing: '100ms',
            result: `Fast: ${result}`,
            completedAt: Date.now()
          })
        }, 100)
      })
    },
    {items: [{value: 10}, {value: 20}]}
  ),

  // Task 1: Very slow complex operation (2000ms)
  threader(
    (data: any) => {
      return new Promise(resolve => {
        setTimeout(() => {
          const processed = data.text.split('').reverse().join('').toUpperCase()
          resolve({
            taskId: 1,
            timing: '2000ms',
            result: `Very Slow: ${processed}`,
            completedAt: Date.now()
          })
        }, 2000)
      })
    },
    {text: 'hello world'}
  ),

  // Task 2: Medium complex operation (500ms)
  threader(
    (data: any) => {
      return new Promise(resolve => {
        setTimeout(() => {
          const filtered = data.numbers.filter((n: number) => n % 2 === 0)
          resolve({
            taskId: 2,
            timing: '500ms',
            result: `Medium: [${filtered.join(', ')}]`,
            completedAt: Date.now()
          })
        }, 500)
      })
    },
    {numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
  ),

  // Task 3: Slow complex operation (1500ms)
  threader(
    (data: any) => {
      return new Promise(resolve => {
        setTimeout(() => {
          const sorted = [...data.words].sort().join(' ')
          resolve({
            taskId: 3,
            timing: '1500ms',
            result: `Slow: ${sorted}`,
            completedAt: Date.now()
          })
        }, 1500)
      })
    },
    {words: ['zebra', 'apple', 'cat', 'dog']}
  ),

  // Task 4: Very fast complex operation (50ms)
  threader(
    (data: any) => {
      return new Promise(resolve => {
        setTimeout(() => {
          const doubled = data.nums.map((n: number) => n * 2)
          resolve({
            taskId: 4,
            timing: '50ms',
            result: `Very Fast: [${doubled.join(', ')}]`,
            completedAt: Date.now()
          })
        }, 50)
      })
    },
    {nums: [1, 2, 3]}
  )
]

/**
 * Test the stream with complex operations that force JS workers
 */
async function testComplexStream() {
  console.log('🔥 Testing Stream with Complex Operations (Forces JS Workers)')
  console.log(
    'These operations are too complex for Rust - must use JavaScript workers'
  )
  console.log('=' * 80)

  const tasks = createComplexTasks()
  const startTime = performance.now()

  console.log('🚀 Starting all tasks simultaneously...')
  console.log(
    'Expected order: Task 4 (50ms) → Task 0 (100ms) → Task 2 (500ms) → Task 3 (1500ms) → Task 1 (2000ms)'
  )
  console.log()

  let resultCount = 0
  const actualOrder: number[] = []

  for await (const result of thread.stream(...tasks)) {
    resultCount++
    const elapsed = performance.now() - startTime
    actualOrder.push(result.result.taskId)

    console.log(`✅ [${resultCount}/5] ${result.result.result}`)
    console.log(
      `   Index: ${result.index} | TaskId: ${
        result.result.taskId
      } | Elapsed: ${elapsed.toFixed(
        0
      )}ms | Duration: ${result.duration.toFixed(0)}ms`
    )

    if (resultCount === 1) {
      if (elapsed < 80) {
        console.log('   🎯 PERFECT: First result came quickly!')
      } else {
        console.log('   ❌ SLOW: First result took too long!')
      }
    }
    console.log()
  }

  const totalTime = performance.now() - startTime

  console.log(`⏱️  Total stream time: ${totalTime.toFixed(0)}ms`)
  console.log(`📊 Actual completion order: [${actualOrder.join(', ')}]`)
  console.log(`🎯 Expected completion order: [4, 0, 2, 3, 1]`)

  const isCorrectOrder = actualOrder.join(',') === '4,0,2,3,1'
  if (isCorrectOrder) {
    console.log('✅ SUCCESS: Results streamed in correct completion order!')
  } else {
    console.log(
      '❌ FAILURE: Results not in completion order - streaming not working'
    )
  }

  console.log()
}

/**
 * Compare with thread.all to show the streaming advantage
 */
async function compareComplexOperations() {
  console.log('📊 Complex Operations: All vs Stream Comparison')
  console.log('=' * 50)

  const tasks1 = createComplexTasks()
  const tasks2 = createComplexTasks()

  // Test thread.all
  console.log('🔄 Testing thread.all (wait for everything):')
  const allStart = performance.now()
  const allResults = await thread.all(...tasks1)
  const allTime = performance.now() - allStart

  console.log(`   ⏳ Total time: ${allTime.toFixed(0)}ms`)
  console.log(`   📦 Got all ${allResults.length} results at once`)
  console.log(`   😴 User waited ${allTime.toFixed(0)}ms to see anything`)
  console.log()

  // Test thread.stream
  console.log('🌊 Testing thread.stream (progressive results):')
  const streamStart = performance.now()
  const streamResults: any[] = []
  const streamTimes: number[] = []

  let count = 0
  for await (const result of thread.stream(...tasks2)) {
    count++
    const elapsed = performance.now() - streamStart
    streamResults.push(result.result)
    streamTimes.push(elapsed)

    console.log(
      `   ⚡ [${count}/5] ${result.result.result} | ${elapsed.toFixed(0)}ms`
    )
  }

  const streamTotalTime = performance.now() - streamStart

  console.log(`\n📈 Stream Results:`)
  console.log(`   ⚡ First result: ${streamTimes[0].toFixed(0)}ms`)
  console.log(`   ⏱️  Total time: ${streamTotalTime.toFixed(0)}ms`)
  console.log(
    `   🎯 Time savings: ${(allTime - streamTimes[0]).toFixed(
      0
    )}ms faster to first result`
  )
  console.log(
    `   💡 Progressive vs blank screen: ${(allTime / streamTimes[0]).toFixed(
      1
    )}x better UX`
  )
}

/**
 * Demonstrate why complex operations show streaming better
 */
async function explainWhyComplexOperations() {
  console.log('\n🎓 Why Complex Operations Show True Streaming')
  console.log('=' * 50)

  console.log('🦀 Simple operations (x * 2, toUpperCase):')
  console.log('   • Rust backend processes them instantly')
  console.log('   • No timing differences to demonstrate streaming')
  console.log('   • All complete in microseconds')
  console.log()

  console.log('🟨 Complex operations (Promise, setTimeout, array methods):')
  console.log('   • Force JavaScript worker execution')
  console.log('   • Real timing differences (50ms vs 2000ms)')
  console.log('   • Show true streaming benefits')
  console.log('   • Demonstrate progressive UX')
  console.log()

  console.log('🎯 Key insight: Streaming benefits are most visible with:')
  console.log('   • Variable execution times (50ms to 2000ms)')
  console.log('   • JavaScript workers (not Rust acceleration)')
  console.log('   • Real async operations (setTimeout, fetch, etc.)')
  console.log('   • Operations that take meaningful time')
}

/**
 * Direct execution test to verify our stream implementation
 */
async function directExecutionTest() {
  console.log('\n🔬 Direct Execution Test (Bypassing Threader)')
  console.log('=' * 45)

  console.log(
    'Testing raw Promise.race with setTimeout to verify the concept...'
  )

  const promises = [
    new Promise(resolve => setTimeout(() => resolve('Task 0: 100ms'), 100)),
    new Promise(resolve => setTimeout(() => resolve('Task 1: 2000ms'), 2000)),
    new Promise(resolve => setTimeout(() => resolve('Task 2: 500ms'), 500)),
    new Promise(resolve => setTimeout(() => resolve('Task 3: 1500ms'), 1500)),
    new Promise(resolve => setTimeout(() => resolve('Task 4: 50ms'), 50))
  ]

  const startTime = performance.now()
  let remaining = [...promises]
  const results: any[] = []

  console.log('🚀 Starting raw Promise.race test...')

  while (remaining.length > 0) {
    const completed = await Promise.race(
      remaining.map((promise, idx) =>
        promise.then(result => ({result, index: idx}))
      )
    )

    const elapsed = performance.now() - startTime
    results.push(completed.result)

    console.log(`✅ ${completed.result} | ${elapsed.toFixed(0)}ms`)

    remaining.splice(completed.index, 1)
  }

  const totalTime = performance.now() - startTime
  console.log(`\n⏱️  Raw Promise.race total: ${totalTime.toFixed(0)}ms`)
  console.log('📊 This should show: 50ms, 100ms, 500ms, 1500ms, 2000ms timing')
  console.log(
    "💡 If this works but threader.stream doesn't, the issue is in threader routing"
  )
}

/**
 * Main test runner
 */
export async function runForceJSStreamTest(): Promise<void> {
  console.log('🧪 Force JavaScript Stream Test')
  console.log('Testing with operations that MUST use JavaScript workers')
  console.log('=' * 60)

  try {
    await testComplexStream()
    await compareComplexOperations()
    await explainWhyComplexOperations()
    await directExecutionTest()

    console.log('\n🎯 DIAGNOSIS:')
    console.log('=' * 20)
    console.log("If raw Promise.race works but thread.stream doesn't:")
    console.log('   → Issue is in threader routing logic')
    console.log('   → Need to bypass Rust backend for complex operations')
    console.log('   → Check executeOptimally function')
    console.log()
    console.log('If both fail:')
    console.log('   → Issue is in Promise.race implementation')
    console.log('   → Need to fix the streaming algorithm')
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.error(error.stack)
  } finally {
    await thread.shutdown()
    console.log('\n✅ Force JS stream test completed!')
  }
}

// CLI runner
runForceJSStreamTest()
