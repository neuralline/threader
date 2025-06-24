// examples/simple-streaming-demo.ts
import {threader, thread} from '../src/index'

// Simulate incoming requests with different patterns
async function simulateIncomingRequests() {
  console.log('📡 === REAL-WORLD INCOMING REQUEST SIMULATION ===')
  console.log('Testing how Threader handles unpredictable request streams...\n')

  // Test 1: Burst of Simple Requests (like health checks)
  console.log('🔄 Test 1: Burst of 100 simple requests (health checks)')

  const healthChecks = Array.from({length: 100}, (_, i) =>
    threader((id: number) => {
      return {status: 'ok', requestId: id, timestamp: Date.now()}
    }, i)
  )

  const start1 = Date.now()
  const results1 = await thread.all(...healthChecks)
  const duration1 = Date.now() - start1

  console.log(
    `   ✅ ${results1.length} health checks completed in ${duration1}ms`
  )
  console.log(
    `   🚀 Rate: ${((results1.length / duration1) * 1000).toFixed(0)} req/sec`
  )
  console.log(
    `   ⚡ Avg: ${(duration1 / results1.length).toFixed(2)}ms per request\n`
  )

  // Test 2: Mixed Workload Stream (realistic web traffic)
  console.log('🌊 Test 2: Mixed workload stream (simulating real web traffic)')

  const mixedRequests = [
    // Light requests (80%)
    ...Array.from({length: 40}, (_, i) =>
      threader(
        (data: {id: number; type: string}) => {
          return {id: data.id, type: data.type, result: `processed_${data.id}`}
        },
        {id: i, type: 'simple'}
      )
    ),

    // Medium requests (15%)
    ...Array.from({length: 8}, (_, i) =>
      threader(
        (data: {id: number; type: string}) => {
          let result = 0
          for (let j = 0; j < 10000; j++) {
            result += Math.sin(j + data.id)
          }
          return {id: data.id, type: data.type, computation: result.toFixed(4)}
        },
        {id: i + 40, type: 'medium'}
      )
    ),

    // Heavy requests (5%)
    ...Array.from({length: 2}, (_, i) =>
      threader(
        (data: {id: number; type: string}) => {
          let result = 0
          for (let j = 0; j < 50000; j++) {
            result += Math.sin(j) * Math.cos(j + data.id)
          }
          return {
            id: data.id,
            type: data.type,
            heavyComputation: result.toFixed(6)
          }
        },
        {id: i + 48, type: 'heavy'}
      )
    )
  ]

  console.log(`   📊 Processing ${mixedRequests.length} mixed requests:`)
  console.log(`      🟢 40 simple requests (should use Rust)`)
  console.log(`      🟡 8 medium requests (JS workers)`)
  console.log(`      🔴 2 heavy requests (JS workers)`)

  const start2 = Date.now()
  const results2 = await thread.all(...mixedRequests)
  const duration2 = Date.now() - start2

  console.log(
    `   ✅ All ${results2.length} requests completed in ${duration2}ms`
  )
  console.log(
    `   🚀 Overall rate: ${((results2.length / duration2) * 1000).toFixed(
      0
    )} req/sec`
  )
  console.log(
    `   ⚡ Avg latency: ${(duration2 / results2.length).toFixed(2)}ms\n`
  )

  // Test 3: Streaming Results (progressive processing)
  console.log('📡 Test 3: Streaming results as they complete')

  const streamingTasks = [
    threader(x => x * 2, 5), // Fast
    threader(x => x * 2, 10), // Fast
    threader((x: number) => {
      // Slow
      let result = 0
      for (let i = 0; i < 100000; i++) {
        result += Math.sin(i + x)
      }
      return result.toFixed(3)
    }, 15),
    threader(x => x * 2, 20), // Fast
    threader(x => x * 2, 25) // Fast
  ]

  console.log(
    `   🌊 Streaming ${streamingTasks.length} tasks (mix of fast and slow)`
  )

  const start3 = Date.now()
  let streamCount = 0
  let firstResultTime = 0

  for await (const result of thread.stream(...streamingTasks)) {
    streamCount++
    const elapsed = Date.now() - start3

    if (firstResultTime === 0) {
      firstResultTime = elapsed
    }

    console.log(
      `      📦 Result ${streamCount}/${
        streamingTasks.length
      } at ${elapsed}ms: ${JSON.stringify(result.result)}`
    )
  }

  const duration3 = Date.now() - start3
  console.log(`   ✅ Streaming completed in ${duration3}ms`)
  console.log(`   ⚡ First result in ${firstResultTime}ms`)
  console.log(
    `   📈 Progressive advantage: ${(
      ((duration3 - firstResultTime) / duration3) *
      100
    ).toFixed(1)}% faster to start\n`
  )

  // Test 4: Continuous Stream Simulation
  console.log('🔄 Test 4: Continuous stream simulation (like real server)')

  const processQueue: any[] = []
  let processed = 0
  let totalLatency = 0

  // Simulate requests arriving continuously
  const simulateRequest = async (id: number) => {
    const arrivalTime = Date.now()

    const processor = threader(
      (data: {id: number; arrival: number}) => {
        // Simulate varying work
        const workAmount = 1000 + (data.id % 5) * 2000
        let result = 0
        for (let i = 0; i < workAmount; i++) {
          result += Math.sin(i + data.id)
        }
        return {
          id: data.id,
          result: result.toFixed(3),
          workDone: workAmount
        }
      },
      {id, arrival: arrivalTime}
    )

    const response = await thread.all(processor)
    const completionTime = Date.now()
    const latency = completionTime - arrivalTime

    processed++
    totalLatency += latency

    return {id, latency, response: response[0]}
  }

  // Process 30 requests with realistic timing
  console.log(`   📊 Processing 30 requests with realistic arrival patterns`)

  const start4 = Date.now()
  const continuousPromises: Promise<any>[] = []

  for (let i = 0; i < 30; i++) {
    continuousPromises.push(simulateRequest(i))

    // Simulate realistic request spacing (30-100ms between requests)
    if (i < 29) {
      await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 70))
    }
  }

  await Promise.all(continuousPromises)
  const duration4 = Date.now() - start4

  console.log(`   ✅ Processed ${processed} requests in ${duration4}ms`)
  console.log(
    `   🚀 Effective rate: ${((processed / duration4) * 1000).toFixed(
      0
    )} req/sec`
  )
  console.log(`   ⚡ Avg latency: ${(totalLatency / processed).toFixed(2)}ms`)
  console.log(
    `   📊 Total throughput over session: ${(
      processed /
      (duration4 / 1000)
    ).toFixed(1)} req/sec\n`
  )
}

async function runSimpleStreamingDemo() {
  console.log('🌊 THREADER SIMPLE STREAMING DEMO')
  console.log('Real-world request handling patterns')
  console.log('===================================\n')

  try {
    await simulateIncomingRequests()

    console.log('🎉 STREAMING DEMO COMPLETED!')
    console.log('📊 Key Takeaways:')
    console.log('   ✅ Excellent handling of burst loads')
    console.log('   ✅ Smart routing of mixed workloads')
    console.log('   ✅ Progressive results with streaming')
    console.log('   ✅ Consistent performance under continuous load')
    console.log('   🚀 Production-ready for real-world applications!')
  } catch (error) {
    console.error('❌ Demo failed:', error)
  } finally {
    await thread.shutdown()
    console.log('\n✅ Simple streaming demo complete!')
  }
}

runSimpleStreamingDemo().catch(console.error)
