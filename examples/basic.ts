// examples/basic.ts
import {threader, thread} from '../src/index'

// Set development mode to allow console warnings
process.env.NODE_ENV = 'development'

async function basicExample() {
  console.log('🚀 Threader Basic Usage Example')

  // Create some processors with pure functions
  const proc1 = threader(x => x * 2, 10)
  const proc2 = threader(x => x + 5, 20)
  const proc3 = threader((x: string) => x.toUpperCase(), 'hello')

  console.log('Created processors:', {
    proc1: {fn: 'x=>x*2', data: 10},
    proc2: {fn: 'x=>x+5', data: 20},
    proc3: {fn: 'x=>x.toUpperCase()', data: 'hello'}
  })

  try {
    console.log('\n📦 Testing thread.all()...')
    const results = await thread.all(proc1, proc2, proc3)
    console.log('Results:', results)
    console.log('Expected: [20, 25, "HELLO"]')

    console.log('\n🏁 Testing thread.race()...')
    const raceProcessors = [
      threader(x => x * x, 4),
      threader(x => x * x, 5),
      threader(x => x * x, 6)
    ]

    const winner = await thread.race(...raceProcessors)
    console.log('Race winner:', winner)

    console.log('\n🌊 Testing thread.stream()...')
    const streamProcessors = [
      threader(x => x * 3, 1),
      threader(x => x * 3, 2),
      threader(x => x * 3, 3)
    ]

    console.log('Processing stream...')
    for await (const result of thread.stream(...streamProcessors)) {
      console.log('Stream result:', result)
    }

    console.log('\n🔥 Testing thread.fire()...')
    // Use pure functions for fire-and-forget
    const fireProcessors = [
      threader(x => x * 3, 10), // Pure function without console.log
      threader(x => x + 100, 5),
      threader((x: string) => x.toLowerCase(), 'WORLD')
    ]

    thread.fire(...fireProcessors)
    console.log('Fire-and-forget tasks started')

    // Give fire tasks time to complete
    await new Promise(resolve => setTimeout(resolve, 100))

    console.log('\n✅ Basic example completed successfully!')
  } catch (error) {
    console.error('❌ Error:', error)
    if (error.name === 'ThreadValidationError') {
      console.log(
        '\n💡 Tip: Functions must be pure (no side effects like console.log)'
      )
      console.log(
        '   Use pure functions like: x => x * 2, x => x.toUpperCase(), etc.'
      )
    }
  }
}

// Test with different function types
async function testFunctionTypes() {
  console.log('\n🧪 Testing Different Function Types')

  try {
    // Test arrow functions
    const arrow1 = threader(x => x * 2, 5)
    const arrow2 = threader((x: number) => x + 10, 3)

    // Test regular functions
    const regular = threader(function (x: number) {
      return x * x
    }, 4)

    // Test async functions
    const async1 = threader(async (x: number) => {
      // Simulate async work
      await new Promise(resolve => setTimeout(resolve, 1))
      return x * 5
    }, 2)

    console.log('Testing various function types...')
    const results = await thread.all(arrow1, arrow2, regular, async1)
    console.log('Function type results:', results)
    console.log('Expected: [10, 13, 16, 10]')
  } catch (error) {
    console.error('Function type test error:', error)
  }
}

// Test complex data types
async function testComplexData() {
  console.log('\n📊 Testing Complex Data Types')

  try {
    // Object processing
    const objProcessor = threader(
      (data: {a: number; b: number}) => {
        return data.a + data.b
      },
      {a: 10, b: 20}
    )

    // Array processing
    const arrayProcessor = threader(
      (arr: number[]) => {
        return arr.reduce((sum, n) => sum + n, 0)
      },
      [1, 2, 3, 4, 5]
    )

    // String processing
    const stringProcessor = threader((text: string) => {
      return text.split('').reverse().join('')
    }, 'hello world')

    const results = await thread.all(
      objProcessor,
      arrayProcessor,
      stringProcessor
    )
    console.log('Complex data results:', results)
    console.log('Expected: [30, 15, "dlrow olleh"]')
  } catch (error) {
    console.error('Complex data test error:', error)
  }
}

// Run all examples
async function runExamples() {
  await basicExample()
  await testFunctionTypes()
  await testComplexData()

  // Shutdown the thread executor
  await thread.shutdown()
  console.log('\n🎉 All examples completed!')
}

runExamples().catch(error => {
  console.error('💥 Example failed:', error)
  process.exit(1)
})
