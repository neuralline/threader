// examples/rust-test.ts
import { threader, thread } from '../src/index'

// Set development mode
process.env.NODE_ENV = 'development'

async function testRustAcceleration() {
  console.log('🦀 Testing Rust Acceleration vs JS Workers\n')

  // Test simple functions that should use Rust
  console.log('=== Testing Simple Functions (Should Use Rust) ===')
  
  const rustFunctions = [
    threader(x => x * 2, 10),       // Should match: x=>x*2
    threader(x => x + 5, 20),       // Should match: x=>x+5
    threader(x => x * x, 4),        // Should match: x=>x*x
    threader(x => x * 3, 7),        // Should match: x=>x*3
    threader((x: string) => x.toUpperCase(), 'hello'),  // Should match
    threader((x: string) => x.toLowerCase(), 'WORLD'),  // Should match
  ]

  const rustResults = await thread.all(...rustFunctions)
  console.log('Rust-accelerated results:', rustResults)
  console.log('Expected: [20, 25, 16, 21, "HELLO", "world"]\n')

  // Test complex functions that should use JS workers
  console.log('=== Testing Complex Functions (Should Use JS Workers) ===')
  
  const jsFunctions = [
    threader((x: number) => Math.sqrt(x), 16),
    threader((arr: number[]) => arr.reduce((a, b) => a + b, 0), [1, 2, 3, 4]),
    threader((obj: {a: number, b: number}) => obj.a * obj.b, {a: 6, b: 7}),
    threader((text: string) => text.split('').reverse().join(''), 'reverse'),
  ]

  const jsResults = await thread.all(...jsFunctions)
  console.log('JS Worker results:', jsResults)
  console.log('Expected: [4, 10, 42, "esrever"]\n')

  // Performance comparison
  console.log('=== Performance Test ===')
  
  const iterations = 100
  console.log(`Running ${iterations} simple calculations...`)
  
  const perfStart = Date.now()
  const perfTasks = Array.from({length: iterations}, (_, i) => 
    threader(x => x * 2, i)
  )
  
  const perfResults = await thread.all(...perfTasks)
  const perfTime = Date.now() - perfStart
  
  console.log(`Completed ${iterations} tasks in ${perfTime}ms`)
  console.log(`Average: ${(perfTime / iterations).toFixed(2)}ms per task`)
  console.log(`First few results: [${perfResults.slice(0, 5).join(', ')}...]`)

  // Shutdown
  await thread.shutdown()
  console.log('\n✅ Rust acceleration test completed!')
}

testRustAcceleration().catch(error => {
  console.error('💥 Test failed:', error)
  process.exit(1)
})