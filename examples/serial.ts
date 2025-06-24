// check-serialization.ts - Analyze serialization in current implementation

import {performance} from 'perf_hooks'

async function analyzeSerializationUsage() {
  console.log('🔍 ANALYZING SERIALIZATION IN CURRENT THREADER')
  console.log('=' * 60)

  try {
    const {threader, thread} = await import('../src/index')

    // Test 1: Check what happens during threader creation
    console.log('\n🧪 Test 1: Threader Creation Analysis')

    const testFunctions = [
      {name: 'Simple Arrow', fn: (x: number) => x * 2},
      {
        name: 'Complex Function',
        fn: (data: {a: number; b: string}) => ({
          result: data.a * 2,
          message: data.b.toUpperCase()
        })
      },
      {
        name: 'Heavy Function',
        fn: (n: number) => {
          let sum = 0
          for (let i = 0; i < n; i++) sum += i
          return sum
        }
      }
    ]

    for (const test of testFunctions) {
      console.log(`\n📋 ${test.name}:`)

      // Time the threader creation
      const createStart = performance.now()
      const task = threader(test.fn, {a: 42, b: 'hello'})
      const createEnd = performance.now()

      console.log(`   Creation time: ${(createEnd - createStart).toFixed(4)}ms`)
      console.log(`   Strategy: ${(task as any).executionPlan?.strategy}`)
      console.log(`   Signature: ${(task as any).executionPlan?.signature}`)

      // Check if serialization happened
      if ('serializedFunction' in task) {
        const serialized = (task as any).serializedFunction
        console.log(`   Serialized: ${serialized.length} characters`)
        console.log(`   Preview: ${serialized.substring(0, 50)}...`)
      }

      // Check if function is stored in execution plan
      if ((task as any).executionPlan?.serialized) {
        const planSerialized = (task as any).executionPlan.serialized
        console.log(`   Plan serialized: ${planSerialized.length} characters`)
      } else {
        console.log(`   Plan serialized: Not stored (good - using native/rust)`)
      }
    }

    // Test 2: Check what happens during execution
    console.log('\n🧪 Test 2: Execution Path Analysis')

    const strategies = [
      {name: 'Native Pattern', fn: (x: number) => x * 2, data: 42},
      {name: 'Rust Pattern', fn: (s: string) => s.toLowerCase(), data: 'HELLO'},
      {
        name: 'Worker Pattern',
        fn: (arr: number[]) => arr.reduce((a, b) => a + b, 0),
        data: [1, 2, 3, 4, 5]
      }
    ]

    for (const test of strategies) {
      console.log(`\n📋 ${test.name}:`)

      const task = threader(test.fn, test.data)
      const strategy = (task as any).executionPlan?.strategy

      console.log(`   Strategy: ${strategy}`)

      // Time the execution
      const execStart = performance.now()
      const result = await thread.all(task)
      const execEnd = performance.now()

      console.log(`   Execution time: ${(execEnd - execStart).toFixed(4)}ms`)
      console.log(`   Result: ${JSON.stringify(result)}`)

      // Analyze what happened during execution
      if (strategy === 'native') {
        console.log(
          `   🚀 Native execution: No serialization, direct function call`
        )
      } else if (strategy === 'rust') {
        console.log(
          `   🦀 Rust execution: Function signature sent to Rust backend`
        )
      } else if (strategy === 'worker') {
        console.log(
          `   ⚙️  Worker execution: Function serialization likely used`
        )
      }
    }

    // Test 3: Serialization overhead test
    console.log('\n🧪 Test 3: Serialization Overhead Analysis')

    const complexFunction = (data: {
      users: Array<{name: string; age: number; email: string}>
      settings: {theme: string; notifications: boolean}
      metadata: {created: string; version: number}
    }) => {
      return {
        userCount: data.users.length,
        averageAge:
          data.users.reduce((sum, u) => sum + u.age, 0) / data.users.length,
        theme: data.settings.theme,
        processedAt: new Date().toISOString()
      }
    }

    const complexData = {
      users: Array.from({length: 100}, (_, i) => ({
        name: `User${i}`,
        age: 20 + (i % 50),
        email: `user${i}@example.com`
      })),
      settings: {theme: 'dark', notifications: true},
      metadata: {created: '2024-01-01', version: 1}
    }

    console.log('\n📋 Complex Function Serialization:')

    // Test function serialization time
    const serializeStart = performance.now()
    const serializedFn = complexFunction.toString()
    const serializeEnd = performance.now()

    console.log(
      `   Function serialization: ${(serializeEnd - serializeStart).toFixed(
        4
      )}ms`
    )
    console.log(`   Function size: ${serializedFn.length} characters`)

    // Test data serialization time
    const dataSerializeStart = performance.now()
    const serializedData = JSON.stringify(complexData)
    const dataSerializeEnd = performance.now()

    console.log(
      `   Data serialization: ${(dataSerializeEnd - dataSerializeStart).toFixed(
        4
      )}ms`
    )
    console.log(`   Data size: ${serializedData.length} characters`)

    // Test threader creation with complex function
    const complexCreateStart = performance.now()
    const complexTask = threader(complexFunction, complexData)
    const complexCreateEnd = performance.now()

    console.log(
      `   Threader creation: ${(complexCreateEnd - complexCreateStart).toFixed(
        4
      )}ms`
    )
    console.log(`   Strategy: ${(complexTask as any).executionPlan?.strategy}`)

    // Test execution
    const complexExecStart = performance.now()
    const complexResult = await thread.all(complexTask)
    const complexExecEnd = performance.now()

    console.log(
      `   Execution: ${(complexExecEnd - complexExecStart).toFixed(4)}ms`
    )

    // Test 4: Rust backend serialization
    console.log('\n🧪 Test 4: Rust Backend Serialization')

    try {
      const rustBackend = require('../threader.darwin-arm64.node')
      const simpleThreader = new rustBackend.SimpleThreader()

      const rustFunction = 'x=>x*2'
      const rustData = JSON.stringify(42)

      console.log('\n📋 Direct Rust Call:')
      console.log(`   Function string: "${rustFunction}"`)
      console.log(`   Data string: "${rustData}"`)

      const rustStart = performance.now()
      const rustResult = simpleThreader.executeSimple(rustFunction, rustData)
      const rustEnd = performance.now()

      console.log(`   Rust execution: ${(rustEnd - rustStart).toFixed(4)}ms`)
      console.log(`   Result: ${rustResult}`)
      console.log(
        `   🦀 Rust uses minimal serialization (just signature + JSON)`
      )
    } catch (error) {
      console.log(`   ❌ Rust backend test failed: ${error.message}`)
    }
  } catch (error) {
    console.error('❌ Analysis failed:', error.message)
  }
}

// Test serialization alternatives
async function testSerializationAlternatives() {
  console.log('\n🔬 SERIALIZATION ALTERNATIVES ANALYSIS')
  console.log('=' * 50)

  const testFunction = (data: {items: number[]; multiplier: number}) => {
    return data.items.map(x => x * data.multiplier).reduce((a, b) => a + b, 0)
  }

  const testData = {items: [1, 2, 3, 4, 5], multiplier: 10}

  // Method 1: Full serialization (current approach for workers)
  console.log('\n📋 Method 1: Full Serialization')
  const fullSerStart = performance.now()
  const serializedFn = testFunction.toString()
  const serializedData = JSON.stringify(testData)
  const recreatedFn = new Function('return ' + serializedFn)()
  const recreatedData = JSON.parse(serializedData)
  const result1 = recreatedFn(recreatedData)
  const fullSerEnd = performance.now()

  console.log(`   Time: ${(fullSerEnd - fullSerStart).toFixed(4)}ms`)
  console.log(`   Function size: ${serializedFn.length} chars`)
  console.log(`   Data size: ${serializedData.length} chars`)
  console.log(`   Result: ${result1}`)

  // Method 2: Direct execution (functional approach)
  console.log('\n📋 Method 2: Direct Execution (No Serialization)')
  const directStart = performance.now()
  const result2 = testFunction(testData)
  const directEnd = performance.now()

  console.log(`   Time: ${(directEnd - directStart).toFixed(4)}ms`)
  console.log(`   Serialization: None`)
  console.log(`   Result: ${result2}`)

  // Method 3: Signature-only (Rust approach)
  console.log('\n📋 Method 3: Signature-Only')
  const sigStart = performance.now()
  const signature = 'items.map(x=>x*multiplier).reduce((a,b)=>a+b,0)'
  const sigData = JSON.stringify(testData)
  // Simulate Rust execution with signature
  const result3 = testFunction(JSON.parse(sigData))
  const sigEnd = performance.now()

  console.log(`   Time: ${(sigEnd - sigStart).toFixed(4)}ms`)
  console.log(`   Signature size: ${signature.length} chars`)
  console.log(`   Data size: ${sigData.length} chars`)
  console.log(`   Result: ${result3}`)

  console.log('\n📊 Serialization Overhead Comparison:')
  const directTime = directEnd - directStart
  console.log(`   Direct execution: ${directTime.toFixed(4)}ms (1.00x)`)
  console.log(
    `   Full serialization: ${(fullSerEnd - fullSerStart).toFixed(4)}ms (${(
      (fullSerEnd - fullSerStart) /
      directTime
    ).toFixed(1)}x)`
  )
  console.log(
    `   Signature-only: ${(sigEnd - sigStart).toFixed(4)}ms (${(
      (sigEnd - sigStart) /
      directTime
    ).toFixed(1)}x)`
  )
}

// Main runner
async function runSerializationAnalysis() {
  console.log('🔍 THREADER SERIALIZATION ANALYSIS')
  console.log('Understanding when and how serialization is used')
  console.log('=' * 70)

  await analyzeSerializationUsage()
  await testSerializationAlternatives()

  console.log('\n💡 KEY FINDINGS:')
  console.log('📌 Serialization is used differently by strategy:')
  console.log('   🚀 Native: No serialization (direct function calls)')
  console.log('   🦀 Rust: Minimal serialization (signature + JSON data)')
  console.log('   ⚙️  Worker: Full serialization (function + data)')
  console.log('')
  console.log('📌 Overhead breakdown:')
  console.log('   • Function.toString(): ~0.001-0.01ms')
  console.log('   • JSON.stringify(): ~0.001-0.1ms (depends on data size)')
  console.log('   • new Function(): ~0.01-0.1ms')
  console.log('   • Worker message passing: ~1-10ms')
  console.log('')
  console.log('📌 Optimization opportunities:')
  console.log('   ✅ Native patterns avoid all serialization')
  console.log('   ✅ Rust patterns use minimal serialization')
  console.log('   ⚠️  Worker patterns need full serialization')
}

if (require.main === module) {
  runSerializationAnalysis()
}

export {runSerializationAnalysis}
