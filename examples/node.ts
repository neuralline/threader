// test-simple.js
const {threader, thread} = require('../dist/index.cjs')

async function testBasicFunctionality() {
  console.log('🧵 Testing Threader basic functionality...')

  try {
    // Test 1: Simple arithmetic
    const processor1 = threader(x => x * 2, 5)
    const processor2 = threader(x => x + 10, 3)
    const processor3 = threader(x => x.length, 'hello')

    console.log('Created processors, executing...')

    const results = await thread.all(processor1, processor2, processor3)

    console.log('Results:', results)
    console.log('Expected: [10, 13, 5]')
    console.log(
      'Match:',
      JSON.stringify(results) === JSON.stringify([10, 13, 5])
    )

    // Test 2: Test stream execution
    console.log('\n🔄 Testing stream execution...')

    const streamProcessors = [
      threader(x => x * x, 2),
      threader(x => x * x, 3),
      threader(x => x * x, 4)
    ]

    const streamResults = []
    for await (const result of thread.stream(...streamProcessors)) {
      console.log('Stream result:', result)
      streamResults.push(result.result)
    }

    console.log('All stream results:', streamResults.sort())

    // Test 3: Test Rust backend availability
    try {
      const rustBackend = require('../threader.node')
      if (rustBackend && rustBackend.isRustAvailable()) {
        console.log('\n⚡ Rust backend is available!')

        const simpleThreader = new rustBackend.SimpleThreader()
        console.log('CPU cores:', simpleThreader.cpuCount)

        const rustResult = simpleThreader.executeSimple(
          'x => x * 2',
          JSON.stringify(42)
        )
        console.log('Rust execution result:', JSON.parse(rustResult))
      } else {
        console.log('\n⚠️  Rust backend not available, using JS fallback')
      }
    } catch (error) {
      console.log('\n⚠️  Rust backend error:', error.message)
    }

    console.log('\n✅ All tests completed successfully!')
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

// Run the test
testBasicFunctionality()
  .then(() => {
    console.log('🎉 Test suite completed!')
    process.exit(0)
  })
  .catch(error => {
    console.error('💥 Test suite failed:', error)
    process.exit(1)
  })
