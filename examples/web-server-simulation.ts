// examples/web-server-simulation.ts
import {threader, thread} from '../src/index'

// Simulate different types of web requests
interface WebRequest {
  id: string
  method: string
  path: string
  headers: Record<string, string>
  body?: any
  timestamp: number
  userAgent: string
  ip: string
}

// Different endpoint types with varying complexity
const ENDPOINT_CONFIGS = {
  '/api/user/profile': {
    complexity: 'low',
    avgProcessingTime: 10,
    description: 'Simple user lookup'
  },
  '/api/search': {
    complexity: 'medium',
    avgProcessingTime: 50,
    description: 'Search with filters'
  },
  '/api/analytics/report': {
    complexity: 'high',
    avgProcessingTime: 200,
    description: 'Complex analytics'
  },
  '/api/image/process': {
    complexity: 'very_high',
    avgProcessingTime: 500,
    description: 'Image processing'
  },
  '/health': {
    complexity: 'minimal',
    avgProcessingTime: 1,
    description: 'Health check'
  }
}

// Request processor that routes to Threader
class ThreadedWebServer {
  private requestCount = 0
  private responseStats = {
    total: 0,
    success: 0,
    errors: 0,
    totalLatency: 0,
    latencyByEndpoint: new Map<string, number[]>(),
    throughputSamples: [] as number[]
  }

  async handleRequest(request: WebRequest): Promise<any> {
    const startTime = Date.now()
    this.requestCount++

    try {
      // Route request based on endpoint
      const endpoint = this.extractEndpoint(request.path)
      const config =
        ENDPOINT_CONFIGS[endpoint] || ENDPOINT_CONFIGS['/api/user/profile']

      // Process request using Threader based on complexity
      const result = await this.processWithThreader(request, config)

      const latency = Date.now() - startTime
      this.recordSuccess(endpoint, latency)

      return {
        status: 200,
        body: result,
        headers: {'Content-Type': 'application/json'},
        latency
      }
    } catch (error) {
      const latency = Date.now() - startTime
      this.recordError(latency)

      return {
        status: 500,
        body: {error: 'Internal server error'},
        headers: {'Content-Type': 'application/json'},
        latency
      }
    }
  }

  private extractEndpoint(path: string): string {
    // Extract base endpoint for routing
    const endpoints = Object.keys(ENDPOINT_CONFIGS)
    return endpoints.find(ep => path.startsWith(ep)) || '/api/user/profile'
  }

  private async processWithThreader(request: WebRequest, config: any) {
    if (config.complexity === 'minimal') {
      // Health check - use Rust for maximum speed
      const processor = threader((data: any) => {
        return {status: 'ok', timestamp: Date.now(), requestId: data.id}
      }, request)
      const results = await thread.all(processor)
      return results
    } else if (config.complexity === 'low') {
      // Simple operations - use Rust when possible
      const processor = threader((data: WebRequest) => {
        return {
          requestId: data.id,
          path: data.path,
          method: data.method,
          processedAt: Date.now(),
          data: {userId: data.id, profile: `user_${data.id}`}
        }
      }, request)
      const results = await thread.all(processor)
      return results
    } else if (config.complexity === 'medium') {
      // Search operations - use JS workers
      const processor = threader((data: WebRequest) => {
        // Simulate search processing
        const searchTerms = ['user', 'product', 'order', 'analytics']
        const results = searchTerms.map(term => ({
          term,
          count:
            Math.floor(Math.sin(data.id.length + term.length) * 1000) + 100,
          relevance: Math.cos(data.id.length * term.length) * 0.5 + 0.5
        }))

        return {
          requestId: data.id,
          searchResults: results,
          totalResults: results.reduce((sum, r) => sum + r.count, 0),
          processedAt: Date.now()
        }
      }, request)
      const results = await thread.all(processor)
      return results
    } else if (config.complexity === 'high') {
      // Analytics - heavy computation
      const processor = threader((data: WebRequest) => {
        // Simulate complex analytics
        const metrics = []
        for (let i = 0; i < 1000; i++) {
          const value = Math.sin(i + data.id.length) * Math.cos(i * 0.1)
          metrics.push(value)
        }

        const analytics = {
          mean: metrics.reduce((a, b) => a + b, 0) / metrics.length,
          max: Math.max(...metrics),
          min: Math.min(...metrics),
          variance: 0 // Simplified
        }

        analytics.variance =
          metrics.reduce(
            (sum, val) => sum + Math.pow(val - analytics.mean, 2),
            0
          ) / metrics.length

        return {
          requestId: data.id,
          analytics,
          dataPoints: metrics.length,
          processedAt: Date.now()
        }
      }, request)
      const results = await thread.all(processor)
      return results
    } else {
      // Very high complexity - image processing simulation
      const processor = threader((data: WebRequest) => {
        // Simulate image processing operations
        const imageSize = 1024 * 768 // Simulated image
        const operations = ['resize', 'blur', 'sharpen', 'colorCorrect']

        const results = operations.map(op => {
          let processedPixels = 0
          // Simulate pixel processing
          for (let i = 0; i < imageSize / 100; i++) {
            processedPixels += Math.sin(i) * Math.cos(i) * 0.5 // Removed Math.random()
          }

          return {
            operation: op,
            processedPixels: Math.floor(Math.abs(processedPixels)),
            duration: Math.floor(Math.sin(data.id.length) * 25) + 25 // Deterministic
          }
        })

        return {
          requestId: data.id,
          imageProcessing: results,
          totalPixels: imageSize,
          processedAt: Date.now()
        }
      }, request)
      const results = await thread.all(processor)
      return results
    }
  }

  private recordSuccess(endpoint: string, latency: number) {
    this.responseStats.total++
    this.responseStats.success++
    this.responseStats.totalLatency += latency

    if (!this.responseStats.latencyByEndpoint.has(endpoint)) {
      this.responseStats.latencyByEndpoint.set(endpoint, [])
    }
    this.responseStats.latencyByEndpoint.get(endpoint)!.push(latency)
  }

  private recordError(latency: number) {
    this.responseStats.total++
    this.responseStats.errors++
    this.responseStats.totalLatency += latency
  }

  getStats() {
    const avgLatency =
      this.responseStats.total > 0
        ? this.responseStats.totalLatency / this.responseStats.total
        : 0

    const endpointStats = new Map()
    for (const [endpoint, latencies] of this.responseStats.latencyByEndpoint) {
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length
      const min = Math.min(...latencies)
      const max = Math.max(...latencies)

      endpointStats.set(endpoint, {avg, min, max, count: latencies.length})
    }

    return {
      ...this.responseStats,
      avgLatency,
      endpointStats,
      successRate:
        this.responseStats.total > 0
          ? (this.responseStats.success / this.responseStats.total) * 100
          : 0
    }
  }

  reset() {
    this.requestCount = 0
    this.responseStats = {
      total: 0,
      success: 0,
      errors: 0,
      totalLatency: 0,
      latencyByEndpoint: new Map(),
      throughputSamples: []
    }
  }
}

// Generate realistic web requests
function generateWebRequest(id: number): WebRequest {
  const endpoints = Object.keys(ENDPOINT_CONFIGS)
  const weights = [0.4, 0.3, 0.2, 0.08, 0.02] // Realistic distribution

  let endpoint = endpoints[0]
  const random = Math.random()
  let cumulative = 0

  for (let i = 0; i < endpoints.length; i++) {
    cumulative += weights[i]
    if (random <= cumulative) {
      endpoint = endpoints[i]
      break
    }
  }

  return {
    id: `req_${id}`,
    method: 'GET',
    path: endpoint,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; LoadTest/1.0)',
      Accept: 'application/json'
    },
    timestamp: Date.now(),
    userAgent: 'LoadTest/1.0',
    ip: `192.168.1.${Math.floor(Math.random() * 255)}`
  }
}

// Demo 1: Steady Load Test
async function steadyLoadTest() {
  console.log('🌐 === WEB SERVER STEADY LOAD TEST ===')
  console.log('Simulating realistic web traffic patterns...\n')

  const server = new ThreadedWebServer()
  const loadTests = [
    {rps: 10, duration: 2, description: 'Light load'},
    {rps: 50, duration: 2, description: 'Medium load'},
    {rps: 100, duration: 2, description: 'Heavy load'},
    {rps: 200, duration: 1, description: 'Peak load'}
  ]

  for (const test of loadTests) {
    server.reset()
    console.log(
      `📊 ${test.description}: ${test.rps} requests/second for ${test.duration}s`
    )

    const startTime = Date.now()
    const promises: Promise<any>[] = []

    // Generate requests at steady rate
    const totalRequests = test.rps * test.duration
    for (let i = 0; i < totalRequests; i++) {
      const request = generateWebRequest(i)
      promises.push(server.handleRequest(request))

      // Add small delay between requests to simulate realistic timing
      if (i < totalRequests - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 / test.rps))
      }
    }

    // Wait for all requests to complete
    await Promise.all(promises)

    const totalTime = Date.now() - startTime
    const stats = server.getStats()

    console.log(`   ✅ Completed: ${stats.total} requests`)
    console.log(`   ⏱️  Total time: ${totalTime}ms`)
    console.log(
      `   🚀 Throughput: ${((stats.total / totalTime) * 1000).toFixed(
        0
      )} req/sec`
    )
    console.log(`   📈 Avg latency: ${stats.avgLatency.toFixed(2)}ms`)
    console.log(`   ✅ Success rate: ${stats.successRate.toFixed(1)}%`)

    // Show per-endpoint stats
    console.log(`   📊 Per-endpoint latencies:`)
    for (const [endpoint, endpointStats] of stats.endpointStats) {
      const config = ENDPOINT_CONFIGS[endpoint]
      console.log(
        `      ${endpoint}: ${endpointStats.avg.toFixed(1)}ms avg (${
          endpointStats.count
        } requests) - ${config?.description}`
      )
    }
    console.log()
  }
}

// Demo 2: Traffic Spike Test
async function trafficSpikeTest() {
  console.log('📈 === WEB SERVER TRAFFIC SPIKE TEST ===')
  console.log('Testing server response to sudden traffic increases...\n')

  const server = new ThreadedWebServer()
  server.reset()

  console.log('Simulating traffic spike pattern:')
  console.log('  🔹 Phase 1: 20 req/sec baseline (2s)')
  console.log('  🔹 Phase 2: 200 req/sec spike (1s)')
  console.log('  🔹 Phase 3: 50 req/sec recovery (2s)\n')

  const phases = [
    {rps: 20, duration: 2, name: 'Baseline'},
    {rps: 200, duration: 1, name: 'Spike'},
    {rps: 50, duration: 2, name: 'Recovery'}
  ]

  let requestId = 0
  const allPromises: Promise<any>[] = []
  const phaseStats: any[] = []

  for (const phase of phases) {
    const phaseStart = Date.now()
    const phasePromises: Promise<any>[] = []

    console.log(`⚡ Starting ${phase.name} phase: ${phase.rps} req/sec`)

    const interval = 1000 / phase.rps
    const totalRequests = phase.rps * phase.duration

    for (let i = 0; i < totalRequests; i++) {
      setTimeout(() => {
        const request = generateWebRequest(requestId++)
        const promise = server.handleRequest(request)
        phasePromises.push(promise)
        allPromises.push(promise)
      }, i * interval)
    }

    // Wait for this phase to complete sending
    await new Promise(resolve => setTimeout(resolve, phase.duration * 1000))

    phaseStats.push({
      name: phase.name,
      requestsSent: totalRequests,
      duration: phase.duration * 1000
    })
  }

  console.log('\n🔄 Waiting for all requests to complete...')
  await Promise.all(allPromises)

  const finalStats = server.getStats()

  console.log(`\n📊 TRAFFIC SPIKE TEST RESULTS:`)
  console.log(`   🚀 Total requests: ${finalStats.total}`)
  console.log(`   ✅ Success rate: ${finalStats.successRate.toFixed(1)}%`)
  console.log(
    `   📈 Overall avg latency: ${finalStats.avgLatency.toFixed(2)}ms`
  )
  console.log(`   ❌ Errors: ${finalStats.errors}`)

  console.log(`\n📊 Per-endpoint performance during spike:`)
  for (const [endpoint, stats] of finalStats.endpointStats) {
    console.log(`   ${endpoint}:`)
    console.log(`     📈 Avg: ${stats.avg.toFixed(1)}ms`)
    console.log(`     🎯 Range: ${stats.min}ms - ${stats.max}ms`)
    console.log(`     📊 Requests: ${stats.count}`)
  }
  console.log()
}

// Demo 3: Concurrent User Simulation
async function concurrentUserTest() {
  console.log('👥 === CONCURRENT USER SIMULATION ===')
  console.log('Simulating multiple users with different usage patterns...\n')

  const server = new ThreadedWebServer()
  server.reset()

  // Define different user behavior patterns
  const userPatterns = [
    {
      name: 'Heavy Browser',
      requestsPerSession: 20,
      avgDelay: 500,
      endpointPreference: ['/api/search', '/api/analytics/report']
    },
    {
      name: 'Mobile User',
      requestsPerSession: 8,
      avgDelay: 1000,
      endpointPreference: ['/api/user/profile', '/health']
    },
    {
      name: 'API Client',
      requestsPerSession: 50,
      avgDelay: 100,
      endpointPreference: ['/api/user/profile', '/api/search']
    },
    {
      name: 'Background Process',
      requestsPerSession: 100,
      avgDelay: 50,
      endpointPreference: ['/api/analytics/report', '/api/image/process']
    }
  ]

  const concurrentUsers = 10
  console.log(
    `👥 Simulating ${concurrentUsers} concurrent users with mixed patterns`
  )

  const userSessions = Array.from({length: concurrentUsers}, (_, i) => {
    const pattern = userPatterns[i % userPatterns.length]
    return simulateUserSession(server, i, pattern)
  })

  const startTime = Date.now()
  await Promise.all(userSessions)
  const totalTime = Date.now() - startTime

  const stats = server.getStats()

  console.log(`\n📊 CONCURRENT USER TEST RESULTS:`)
  console.log(`   👥 Users: ${concurrentUsers}`)
  console.log(`   ⏱️  Total duration: ${(totalTime / 1000).toFixed(1)}s`)
  console.log(`   🚀 Total requests: ${stats.total}`)
  console.log(
    `   📈 Avg requests/user: ${(stats.total / concurrentUsers).toFixed(1)}`
  )
  console.log(
    `   ⚡ Overall throughput: ${((stats.total / totalTime) * 1000).toFixed(
      0
    )} req/sec`
  )
  console.log(`   📊 Avg latency: ${stats.avgLatency.toFixed(2)}ms`)
  console.log(`   ✅ Success rate: ${stats.successRate.toFixed(1)}%`)

  console.log(`\n📊 Endpoint usage distribution:`)
  for (const [endpoint, endpointStats] of stats.endpointStats) {
    const percentage = ((endpointStats.count / stats.total) * 100).toFixed(1)
    console.log(
      `   ${endpoint}: ${
        endpointStats.count
      } requests (${percentage}%) - ${endpointStats.avg.toFixed(1)}ms avg`
    )
  }
  console.log()
}

async function simulateUserSession(
  server: ThreadedWebServer,
  userId: number,
  pattern: any
) {
  let requestId = 0

  for (let i = 0; i < pattern.requestsPerSession; i++) {
    // Choose endpoint based on user preference
    const endpoint =
      pattern.endpointPreference[
        Math.floor(Math.random() * pattern.endpointPreference.length)
      ]

    const request: WebRequest = {
      id: `user${userId}_req${requestId++}`,
      method: 'GET',
      path: endpoint,
      headers: {
        'User-Agent': `UserAgent-${pattern.name}`,
        Accept: 'application/json'
      },
      timestamp: Date.now(),
      userAgent: pattern.name,
      ip: `192.168.1.${userId + 10}`
    }

    try {
      await server.handleRequest(request)
    } catch (error) {
      console.warn(`User ${userId} request failed:`, error.message)
    }

    // Wait before next request (simulate user behavior)
    const delay =
      pattern.avgDelay + (Math.random() - 0.5) * pattern.avgDelay * 0.5
    await new Promise(resolve => setTimeout(resolve, delay))
  }
}

// Demo 4: Real-time Monitoring Simulation
async function realTimeMonitoringTest() {
  console.log('📡 === REAL-TIME MONITORING SIMULATION ===')
  console.log('Testing continuous request processing with live metrics...\n')

  const server = new ThreadedWebServer()
  server.reset()

  const monitoringDuration = 10000 // 10 seconds
  const baselineRps = 30

  console.log(
    `📊 Running continuous load for ${
      monitoringDuration / 1000
    }s at ${baselineRps} req/sec`
  )
  console.log('📈 Live metrics updating every second...\n')

  let requestCounter = 0
  let isRunning = true

  // Start request generator
  const requestGenerator = setInterval(() => {
    if (!isRunning) return

    const request = generateWebRequest(requestCounter++)
    server
      .handleRequest(request)
      .catch(err => console.warn('Request failed:', err.message))
  }, 1000 / baselineRps)

  // Monitor stats every second
  const statsMonitor = setInterval(() => {
    if (!isRunning) return

    const stats = server.getStats()
    const timestamp = new Date().toLocaleTimeString()

    console.log(
      `[${timestamp}] Processed: ${
        stats.total
      }, Avg latency: ${stats.avgLatency.toFixed(
        1
      )}ms, Success: ${stats.successRate.toFixed(1)}%`
    )
  }, 1000)

  // Stop after duration
  setTimeout(() => {
    isRunning = false
    clearInterval(requestGenerator)
    clearInterval(statsMonitor)
  }, monitoringDuration)

  // Wait for completion
  await new Promise(resolve => setTimeout(resolve, monitoringDuration + 1000))

  const finalStats = server.getStats()

  console.log(`\n📊 REAL-TIME MONITORING RESULTS:`)
  console.log(`   ⏱️  Duration: ${monitoringDuration / 1000}s`)
  console.log(`   🚀 Total requests: ${finalStats.total}`)
  console.log(
    `   📈 Actual RPS: ${(
      finalStats.total /
      (monitoringDuration / 1000)
    ).toFixed(1)}`
  )
  console.log(`   ⚡ Avg latency: ${finalStats.avgLatency.toFixed(2)}ms`)
  console.log(`   ✅ Success rate: ${finalStats.successRate.toFixed(1)}%`)
  console.log(`   ❌ Errors: ${finalStats.errors}`)
}

// Main test runner
async function runWebServerSimulation() {
  console.log('🌐 THREADER WEB SERVER SIMULATION')
  console.log('Real-world HTTP request processing')
  console.log('==================================\n')

  try {
    await steadyLoadTest()
    await trafficSpikeTest()
    await concurrentUserTest()
    await realTimeMonitoringTest()

    console.log('\n🎉 ALL WEB SERVER SIMULATIONS COMPLETED!')
    console.log('🚀 Threader demonstrates excellent web server performance!')
  } catch (error) {
    console.error('❌ Web server simulation failed:', error)
  } finally {
    await thread.shutdown()
    console.log('\n✅ Web server simulation complete!')
  }
}

runWebServerSimulation().catch(console.error)
