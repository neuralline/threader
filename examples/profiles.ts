// profiler.ts - Detailed performance breakdown
import {performance} from 'perf_hooks'
import {threader} from '../src/index'
import {thread} from '../src/index'

interface ProfileStep {
  name: string
  startTime: number
  endTime: number
  duration: number
}

interface DetailedProfile {
  totalDuration: number
  steps: ProfileStep[]
  overhead: {
    serialization: number
    rustExecution: number
    jsWorkerSetup: number
    dataTransfer: number
    resultProcessing: number
  }
}

/**
 * High-resolution profiler for Threader pipeline
 */
class ThreaderProfiler {
  private profiles: ProfileStep[] = []

  startStep(name: string): void {
    this.profiles.push({
      name,
      startTime: performance.now(),
      endTime: 0,
      duration: 0
    })
  }

  endStep(name: string): void {
    const step = this.profiles.find(s => s.name === name && s.endTime === 0)
    if (step) {
      step.endTime = performance.now()
      step.duration = step.endTime - step.startTime
    }
  }

  getProfile(): ProfileStep[] {
    return [...this.profiles]
  }

  reset(): void {
    this.profiles = []
  }
}

/**
 * Profile the serialization overhead
 */
async function profileSerialization(): Promise<DetailedProfile> {
  const profiler = new ThreaderProfiler()
  const testFn = (x: number) => x * 2
  const testData = 42

  profiler.startStep('total')

  // Step 1: Function serialization
  profiler.startStep('function-serialization')
  const serializedFn = testFn.toString()
  profiler.endStep('function-serialization')

  // Step 2: Data serialization
  profiler.startStep('data-serialization')
  const serializedData = JSON.stringify(testData)
  profiler.endStep('data-serialization')

  // Step 3: Threader creation
  profiler.startStep('threader-creation')
  const task = threader(testFn, testData)
  profiler.endStep('threader-creation')

  // Step 4: Task JSON creation
  profiler.startStep('task-json')
  const taskJson = task.toJSON()
  profiler.endStep('task-json')

  profiler.endStep('total')

  const steps = profiler.getProfile()

  return {
    totalDuration: steps.find(s => s.name === 'total')?.duration || 0,
    steps,
    overhead: {
      serialization:
        (steps.find(s => s.name === 'function-serialization')?.duration || 0) +
        (steps.find(s => s.name === 'data-serialization')?.duration || 0),
      rustExecution: 0,
      jsWorkerSetup: 0,
      dataTransfer: 0,
      resultProcessing: 0
    }
  }
}

/**
 * Profile Rust backend execution path
 */
async function profileRustExecution(): Promise<DetailedProfile> {
  const profiler = new ThreaderProfiler()

  try {
    // Try to load Rust backend directly
    const rustBackend = require('../threader.darwin-arm64.node')
    const threaderInstance = new rustBackend.SimpleThreader()

    profiler.startStep('total')

    // Step 1: Rust setup
    profiler.startStep('rust-setup')
    const functionString = '(x) => x * 2'
    const data = JSON.stringify(42)
    profiler.endStep('rust-setup')

    // Step 2: Direct Rust execution
    profiler.startStep('rust-execute')
    const result = threaderInstance.executeSimple(functionString, data)
    profiler.endStep('rust-execute')

    // Step 3: Result parsing
    profiler.startStep('result-parsing')
    const parsedResult = JSON.parse(result)
    profiler.endStep('result-parsing')

    profiler.endStep('total')

    const steps = profiler.getProfile()

    return {
      totalDuration: steps.find(s => s.name === 'total')?.duration || 0,
      steps,
      overhead: {
        serialization: 0,
        rustExecution:
          steps.find(s => s.name === 'rust-execute')?.duration || 0,
        jsWorkerSetup: 0,
        dataTransfer: 0,
        resultProcessing:
          steps.find(s => s.name === 'result-parsing')?.duration || 0
      }
    }
  } catch (error) {
    console.error('Failed to profile Rust execution:', error.message)
    return {
      totalDuration: 0,
      steps: [],
      overhead: {
        serialization: 0,
        rustExecution: 0,
        jsWorkerSetup: 0,
        dataTransfer: 0,
        resultProcessing: 0
      }
    }
  }
}

/**
 * Profile full Threader execution pipeline
 */
async function profileFullExecution(): Promise<DetailedProfile> {
  const profiler = new ThreaderProfiler()

  profiler.startStep('total')

  // Step 1: Threader creation
  profiler.startStep('threader-creation')
  const task = threader((x: number) => x * 2, 42)
  profiler.endStep('threader-creation')

  // Step 2: Thread executor call
  profiler.startStep('thread-execution')
  const result = await thread.all(task)
  profiler.endStep('thread-execution')

  profiler.endStep('total')

  const steps = profiler.getProfile()

  return {
    totalDuration: steps.find(s => s.name === 'total')?.duration || 0,
    steps,
    overhead: {
      serialization:
        steps.find(s => s.name === 'threader-creation')?.duration || 0,
      rustExecution: 0,
      jsWorkerSetup: 0,
      dataTransfer: 0,
      resultProcessing:
        (steps.find(s => s.name === 'total')?.duration || 0) -
        (steps.find(s => s.name === 'thread-execution')?.duration || 0)
    }
  }
}

/**
 * Profile worker thread setup overhead
 */
async function profileWorkerSetup(): Promise<DetailedProfile> {
  const profiler = new ThreaderProfiler()

  profiler.startStep('total')

  // Test with a function that should use JS worker
  const complexFn = (arr: number[]) => arr.filter(x => x > 50).length
  const testData = Array.from({length: 100}, (_, i) => i)

  profiler.startStep('task-creation')
  const task = threader(complexFn, testData)
  profiler.endStep('task-creation')

  profiler.startStep('worker-execution')
  const result = await thread.all(task)
  profiler.endStep('worker-execution')

  profiler.endStep('total')

  const steps = profiler.getProfile()

  return {
    totalDuration: steps.find(s => s.name === 'total')?.duration || 0,
    steps,
    overhead: {
      serialization: steps.find(s => s.name === 'task-creation')?.duration || 0,
      rustExecution: 0,
      jsWorkerSetup:
        steps.find(s => s.name === 'worker-execution')?.duration || 0,
      dataTransfer: 0,
      resultProcessing: 0
    }
  }
}

/**
 * Compare overhead sources
 */
async function analyzeOverheadSources(): Promise<void> {
  console.log('🔍 DETAILED OVERHEAD ANALYSIS')
  console.log('=' * 50)

  // Baseline: Direct execution
  const baselineStart = performance.now()
  const directResult = 42 * 2
  const baselineEnd = performance.now()
  const baselineDuration = baselineEnd - baselineStart

  console.log(
    `\n📊 Baseline (direct execution): ${baselineDuration.toFixed(4)}ms`
  )

  // Profile 1: Serialization overhead
  console.log('\n🔧 Profiling serialization...')
  const serializationProfile = await profileSerialization()
  console.log('Serialization steps:')
  serializationProfile.steps.forEach(step => {
    if (step.endTime > 0) {
      console.log(`   ${step.name}: ${step.duration.toFixed(4)}ms`)
    }
  })

  // Profile 2: Direct Rust execution
  console.log('\n🦀 Profiling direct Rust execution...')
  const rustProfile = await profileRustExecution()
  console.log('Rust execution steps:')
  rustProfile.steps.forEach(step => {
    if (step.endTime > 0) {
      console.log(`   ${step.name}: ${step.duration.toFixed(4)}ms`)
    }
  })

  // Profile 3: Full Threader pipeline
  console.log('\n🚀 Profiling full Threader pipeline...')
  const fullProfile = await profileFullExecution()
  console.log('Full pipeline steps:')
  fullProfile.steps.forEach(step => {
    if (step.endTime > 0) {
      console.log(`   ${step.name}: ${step.duration.toFixed(4)}ms`)
    }
  })

  // Profile 4: JS Worker setup
  console.log('\n⚙️ Profiling JS worker execution...')
  const workerProfile = await profileWorkerSetup()
  console.log('Worker execution steps:')
  workerProfile.steps.forEach(step => {
    if (step.endTime > 0) {
      console.log(`   ${step.name}: ${step.duration.toFixed(4)}ms`)
    }
  })

  // Analysis
  console.log('\n📈 OVERHEAD BREAKDOWN')
  console.log('=' * 40)

  const rustOverhead = rustProfile.totalDuration / baselineDuration
  const fullOverhead = fullProfile.totalDuration / baselineDuration
  const workerOverhead = workerProfile.totalDuration / baselineDuration

  console.log(`Baseline execution: ${baselineDuration.toFixed(4)}ms`)
  console.log(
    `Direct Rust: ${rustProfile.totalDuration.toFixed(
      4
    )}ms (${rustOverhead.toFixed(1)}x overhead)`
  )
  console.log(
    `Full Threader: ${fullProfile.totalDuration.toFixed(
      4
    )}ms (${fullOverhead.toFixed(1)}x overhead)`
  )
  console.log(
    `JS Worker: ${workerProfile.totalDuration.toFixed(
      4
    )}ms (${workerOverhead.toFixed(1)}x overhead)`
  )

  // Identify the biggest bottleneck
  console.log('\n🎯 BOTTLENECK ANALYSIS')
  console.log('=' * 30)

  if (rustProfile.totalDuration > 1) {
    console.log('❌ Rust execution is unexpectedly slow')
  } else {
    console.log('✅ Rust execution is fast')
  }

  const pipelineOverhead = fullProfile.totalDuration - rustProfile.totalDuration
  if (pipelineOverhead > 10) {
    console.log('❌ High pipeline overhead - investigate thread management')
  } else if (pipelineOverhead > 1) {
    console.log('⚠️ Moderate pipeline overhead')
  } else {
    console.log('✅ Low pipeline overhead')
  }

  if (workerProfile.totalDuration > fullProfile.totalDuration * 2) {
    console.log('❌ JS workers are much slower than expected')
  }

  // Recommendations
  console.log('\n💡 OPTIMIZATION RECOMMENDATIONS')
  console.log('=' * 40)

  if (fullOverhead > 100) {
    console.log('🔧 Consider bypassing the full pipeline for simple operations')
    console.log('🔧 Implement direct Rust execution path')
    console.log('🔧 Add task batching to amortize setup costs')
  }

  if (rustProfile.totalDuration > 0.1) {
    console.log('🔧 Optimize Rust pattern matching')
    console.log('🔧 Consider pre-compiled function lookup')
  }

  if (pipelineOverhead > 5) {
    console.log('🔧 Investigate thread/worker management overhead')
    console.log('🔧 Consider worker pooling optimization')
  }
}

/**
 * Run micro-benchmark to isolate each component
 */
async function runMicroBenchmarks(): Promise<void> {
  console.log('\n🔬 MICRO-BENCHMARKS')
  console.log('=' * 30)

  const iterations = 1000

  // Benchmark 1: Function toString
  let start = performance.now()
  for (let i = 0; i < iterations; i++) {
    const fn = (x: number) => x * 2
    fn.toString()
  }
  let end = performance.now()
  console.log(
    `Function.toString(): ${((end - start) / iterations).toFixed(4)}ms avg`
  )

  // Benchmark 2: JSON.stringify
  start = performance.now()
  for (let i = 0; i < iterations; i++) {
    JSON.stringify(42)
  }
  end = performance.now()
  console.log(
    `JSON.stringify(42): ${((end - start) / iterations).toFixed(4)}ms avg`
  )

  // Benchmark 3: Object creation
  start = performance.now()
  for (let i = 0; i < iterations; i++) {
    const obj = {id: i, function: '(x) => x * 2', data: '42'}
  }
  end = performance.now()
  console.log(
    `Object creation: ${((end - start) / iterations).toFixed(4)}ms avg`
  )

  // Benchmark 4: Promise creation/resolution
  start = performance.now()
  const promises = []
  for (let i = 0; i < iterations; i++) {
    promises.push(Promise.resolve(42))
  }
  await Promise.all(promises)
  end = performance.now()
  console.log(
    `Promise.resolve(): ${((end - start) / iterations).toFixed(4)}ms avg`
  )
}

/**
 * Main profiler runner
 */
export async function runThreaderProfiler(): Promise<void> {
  console.log('🔍 Threader Performance Profiler')
  console.log('   Analyzing overhead sources...\n')

  try {
    await runMicroBenchmarks()
    await analyzeOverheadSources()
  } catch (error) {
    console.error('❌ Profiling failed:', error.message)
    console.error('Stack:', error.stack)
  }
}

// CLI runner
if (require.main === module) {
  runThreaderProfiler()
}
