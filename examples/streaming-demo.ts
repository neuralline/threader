// examples/streaming-demo.ts
import {threader, thread} from '../src/index'

// Real-time data processing simulation
async function realTimeProcessingDemo() {
  console.log('📡 === REAL-TIME DATA STREAMING DEMO ===')
  console.log('Simulating live data processing pipeline...\n')

  // Simulate incoming data batches
  const dataBatches = Array.from({length: 20}, (_, i) => ({
    batchId: i + 1,
    timestamp: Date.now() + i * 100,
    data: Array.from({length: 1000}, () => Math.random() * 100),
    priority: Math.random() > 0.7 ? 'high' : 'normal'
  }))

  // Create processors for different batch types
  const processors = dataBatches.map((batch, index) =>
    threader(
      (data: any) => {
        const {batch, startTime} = data

        // Simulate different processing based on priority
        if (batch.priority === 'high') {
          // Complex analytics for high priority
          const stats = {
            mean:
              batch.data.reduce((a: number, b: number) => a + b, 0) /
              batch.data.length,
            max: Math.max(...batch.data),
            min: Math.min(...batch.data),
            outliers: batch.data.filter((x: number) => {
              const mean =
                batch.data.reduce((a: number, b: number) => a + b, 0) /
                batch.data.length
              return Math.abs(x - mean) > 30
            }).length
          }

          // Simulate processing time with CPU-intensive work
          let cycles = 0
          for (let i = 0; i < 10000; i++) {
            cycles += Math.sin(i) * Math.cos(i)
          }

          return {
            batchId: batch.batchId,
            priority: batch.priority,
            processingCycles: cycles.toFixed(2),
            stats,
            alert: stats.outliers > 50 ? 'ANOMALY_DETECTED' : 'NORMAL'
          }
        } else {
          // Simple processing for normal priority
          const sum = batch.data.reduce((a: number, b: number) => a + b, 0)

          // Simulate lighter processing
          let cycles = 0
          for (let i = 0; i < 5000; i++) {
            cycles += Math.sqrt(i)
          }

          return {
            batchId: batch.batchId,
            priority: batch.priority,
            processingCycles: cycles.toFixed(2),
            sum: sum.toFixed(2),
            count: batch.data.length
          }
        }
      },
      {batch, startTime: Date.now()}
    )
  )

  console.log(`🚀 Processing ${processors.length} data batches in parallel...`)
  console.log('📊 Results streaming in real-time:\n')

  let processedCount = 0
  let alerts = 0

  // Process results as they stream in
  for await (const result of thread.stream(...processors)) {
    processedCount++

    if (result.result.priority === 'high') {
      console.log(
        `🔥 HIGH PRIORITY Batch #${result.result.batchId} [${result.duration}ms]`
      )
      console.log(
        `   📈 Mean: ${result.result.stats.mean.toFixed(2)}, Outliers: ${
          result.result.stats.outliers
        }`
      )
      console.log(`   ⚡ Processing cycles: ${result.result.processingCycles}`)
      if (result.result.alert === 'ANOMALY_DETECTED') {
        console.log(`   🚨 ALERT: ${result.result.alert}`)
        alerts++
      }
    } else {
      console.log(
        `📊 Batch #${result.result.batchId}: Sum=${result.result.sum}, Count=${result.result.count} [${result.duration}ms]`
      )
      console.log(`   ⚡ Processing cycles: ${result.result.processingCycles}`)
    }

    // Show progress
    const progress = ((processedCount / processors.length) * 100).toFixed(0)
    console.log(
      `   Progress: ${progress}% (${processedCount}/${processors.length})\n`
    )

    // Simulate real-time delay
    await new Promise(resolve => setTimeout(resolve, 50))
  }

  console.log(`✅ Real-time processing complete!`)
  console.log(`📊 Processed ${processedCount} batches`)
  console.log(`🚨 Alerts generated: ${alerts}`)
  console.log(
    `⚡ Average processing: ~${(
      (processors.length / processedCount) *
      50
    ).toFixed(0)}ms per batch\n`
  )
}

// Live monitoring simulation
async function liveMonitoringDemo() {
  console.log('🖥️  === LIVE SYSTEM MONITORING DEMO ===')
  console.log('Simulating parallel monitoring of multiple services...\n')

  const services = [
    {name: 'API Gateway', url: 'https://api.company.com', expected: 200},
    {name: 'Database', url: 'postgres://db.company.com', expected: 'OK'},
    {name: 'Cache Redis', url: 'redis://cache.company.com', expected: 'PONG'},
    {name: 'Message Queue', url: 'amqp://queue.company.com', expected: 'READY'},
    {
      name: 'File Storage',
      url: 'https://files.company.com',
      expected: 'ONLINE'
    },
    {name: 'Analytics', url: 'https://analytics.company.com', expected: 200},
    {
      name: 'Auth Service',
      url: 'https://auth.company.com',
      expected: 'HEALTHY'
    },
    {
      name: 'Payment Gateway',
      url: 'https://payments.company.com',
      expected: 'ACTIVE'
    }
  ]

  console.log('🔍 Monitoring services in parallel...\n')

  // Create health check processors
  const healthChecks = services.map(
    (service, index) =>
      threader(
        (data: any) => {
          const {service, seed} = data

          // Use seed for deterministic "randomness"
          const pseudoRandom1 = Math.sin(seed * 12.9898) * 43758.5453
          const pseudoRandom2 = Math.sin(seed * 78.233) * 43758.5453

          const responseTime =
            Math.abs(pseudoRandom1 - Math.floor(pseudoRandom1)) * 900 + 100 // 100-1000ms
          const isHealthy =
            Math.abs(pseudoRandom2 - Math.floor(pseudoRandom2)) > 0.1 // 90% success rate

          // Simulate CPU work for response time
          let work = 0
          const cycles = Math.floor(responseTime * 1000)
          for (let i = 0; i < cycles; i++) {
            work += Math.sin(i / 1000)
          }

          return {
            service: service.name,
            url: service.url,
            status: isHealthy ? 'HEALTHY' : 'UNHEALTHY',
            responseTime: Math.floor(responseTime),
            workCompleted: work.toFixed(2),
            details: isHealthy
              ? `Response: ${service.expected}`
              : `Error: ${
                  ['Timeout', 'Connection refused', '503 Service Unavailable'][
                    Math.floor(
                      Math.abs(pseudoRandom1 - Math.floor(pseudoRandom1)) * 3
                    )
                  ]
                }`
          }
        },
        {service, seed: index + Date.now()}
      ) // Seed with current time + index for variety
  )

  let completed = 0
  const results: any[] = []

  console.log('📡 Health check results streaming in...\n')

  for await (const result of thread.stream(...healthChecks)) {
    completed++
    results.push(result.result)

    const status = result.result.status === 'HEALTHY' ? '✅' : '❌'
    const responseTime = `${result.result.responseTime}ms`

    console.log(
      `${status} ${result.result.service.padEnd(15)} | ${responseTime.padStart(
        6
      )} | ${result.result.details}`
    )

    if (result.result.status === 'UNHEALTHY') {
      console.log(`   🚨 ALERT: ${result.result.service} is down!`)
    }
  }

  const healthyServices = results.filter(r => r.status === 'HEALTHY').length
  const avgResponseTime =
    results.reduce((sum, r) => sum + r.responseTime, 0) / results.length

  console.log(`\n📊 MONITORING SUMMARY:`)
  console.log(`✅ Healthy services: ${healthyServices}/${results.length}`)
  console.log(`⚡ Average response time: ${avgResponseTime.toFixed(0)}ms`)
  console.log(
    `🚨 System status: ${
      healthyServices === results.length
        ? 'ALL SYSTEMS OPERATIONAL'
        : 'DEGRADED PERFORMANCE'
    }`
  )
  console.log(
    `🕐 Total monitoring time: ${Math.max(
      ...results.map(r => r.responseTime)
    )}ms (parallel)\n`
  )
}

async function runStreamingDemos() {
  console.log('🌊 THREADER STREAMING DEMOS')
  console.log('============================\n')

  try {
    await realTimeProcessingDemo()
    await liveMonitoringDemo()

    console.log('🎉 ALL STREAMING DEMOS COMPLETED!')
    console.log('📡 Real-time processing capabilities demonstrated!')
  } catch (error) {
    console.error('❌ Streaming demo failed:', error)
  } finally {
    await thread.shutdown()
    console.log('\n✅ Streaming demos complete!')
  }
}

runStreamingDemos().catch(console.error)
