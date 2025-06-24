// examples/simple-threader-loop.ts
import {threader, thread} from '../src/index'

async function simpleThreaderLoop() {
  console.log('🔄 SIMPLE THREADER LOOP EXAMPLES')
  console.log('Showing function validation in action\n')

  // Example 1: Basic Threader Loop (VALID)
  console.log('✅ Example 1: Valid Pure Functions')
  const numbers = [1, 2, 3, 4, 5]

  try {
    const processors = numbers.map(
      n => threader(x => x * 2, n) // ✅ Pure function: no side effects
    )

    const results = await thread.all(...processors)
    console.log(`   Input: [${numbers.join(', ')}]`)
    console.log(`   Output: [${results.join(', ')}]`)
    console.log('   ✅ Validation passed: Pure function allowed\n')
  } catch (error) {
    console.log('   ❌ Validation failed:', error.message)
  }

  // Example 2: Function with Side Effects (INVALID)
  console.log('❌ Example 2: Invalid Function with Side Effects')

  try {
    const badProcessors = numbers.map(n =>
      threader(x => {
        console.log(`Processing ${x}`) // ❌ Side effect: console.log
        return x * 2
      }, n)
    )

    const results = await thread.all(...badProcessors)
    console.log('   Results:', results)
  } catch (error) {
    console.log(`   ❌ Validation caught side effect: ${error.name}`)
    console.log(`   ❌ Error: ${error.message}\n`)
  }

  // Example 3: Non-deterministic Function (INVALID)
  console.log('❌ Example 3: Non-deterministic Function')

  try {
    const randomProcessors = numbers.map(
      n => threader(x => x + Math.random(), n) // ❌ Non-deterministic: Math.random
    )

    const results = await thread.all(...randomProcessors)
    console.log('   Results:', results)
  } catch (error) {
    console.log(
      `   ❌ Validation caught non-deterministic function: ${error.name}`
    )
    console.log(`   ❌ Error: ${error.message}\n`)
  }

  // Example 4: Complex but Valid Function
  console.log('✅ Example 4: Complex but Valid Pure Function')

  try {
    const complexProcessors = numbers.map(n =>
      threader((x: number) => {
        // ✅ Pure mathematical computation
        let result = x
        for (let i = 0; i < 1000; i++) {
          result = Math.sin(result) + Math.cos(i)
        }
        return parseFloat(result.toFixed(4))
      }, n)
    )

    const results = await thread.all(...complexProcessors)
    console.log(`   Input: [${numbers.join(', ')}]`)
    console.log(`   Output: [${results.join(', ')}]`)
    console.log('   ✅ Validation passed: Complex but pure function allowed\n')
  } catch (error) {
    console.log('   ❌ Validation failed:', error.message)
  }

  // Example 5: What the Validation is Checking
  console.log('🔍 WHAT VALIDATION CHECKS:')
  console.log('=============================')

  const validExamples = [
    'x => x * 2',
    'x => x + 10',
    'x => Math.sin(x)',
    'arr => arr.filter(x => x > 0)',
    'str => str.toUpperCase()',
    'obj => ({ ...obj, processed: true })'
  ]

  const invalidExamples = [
    'x => { console.log(x); return x }', // Side effect
    'x => fetch("/api/data")', // Network request
    'x => Math.random() * x', // Non-deterministic
    'x => { window.alert(x); return x }', // DOM manipulation
    'x => { localStorage.setItem("key", x); return x }' // Storage access
  ]

  console.log('✅ VALID (Pure) Functions:')
  validExamples.forEach(fn => console.log(`   ${fn}`))

  console.log('\n❌ INVALID (Impure) Functions:')
  invalidExamples.forEach(fn => console.log(`   ${fn}`))

  console.log('\n💡 Why Validation Matters:')
  console.log('   🔒 Ensures thread safety (no shared state modification)')
  console.log('   🎯 Guarantees reproducible results (deterministic)')
  console.log('   ⚡ Enables safe parallel execution across workers')
  console.log('   🛡️ Prevents runtime errors in worker threads')
  console.log('   📊 Allows Rust acceleration for simple patterns')
}

// Example 6: Bypass Validation (Advanced Usage)
async function bypassValidationExample() {
  console.log('\n🔧 ADVANCED: Bypassing Validation')
  console.log('===================================')

  try {
    // Sometimes you might want to disable validation for trusted code
    const processorWithoutValidation = threader(
      x => x * 2, // We know this is safe
      5,
      {validate: false} // Disable validation
    )

    const result = await thread.all(processorWithoutValidation)
    console.log('   ✅ Validation bypassed, result:', result)
    console.log('   ⚠️  Use carefully: Only for trusted, tested functions')
  } catch (error) {
    console.log('   ❌ Error:', error.message)
  }
}

// Example 7: Real-World Data Processing Loop
async function realWorldExample() {
  console.log('\n🌍 REAL-WORLD: Data Processing Loop')
  console.log('===================================')

  // Simulate a dataset
  const dataset = Array.from({length: 100}, (_, i) => ({
    id: i + 1,
    value: Math.floor(Math.sin(i) * 1000) + 1000,
    category: ['A', 'B', 'C'][i % 3]
  }))

  console.log(`📊 Processing ${dataset.length} records...`)

  try {
    // ✅ Pure data transformation
    const processors = dataset.map(record =>
      threader((data: any) => {
        // Complex but pure business logic
        const processed = {
          ...data,
          normalizedValue: data.value / 1000,
          categoryScore:
            data.category === 'A' ? 1 : data.category === 'B' ? 2 : 3,
          computed: Math.sqrt(data.value) + data.id * 0.1
        }

        return {
          id: processed.id,
          score: processed.normalizedValue * processed.categoryScore,
          result: parseFloat(processed.computed.toFixed(2))
        }
      }, record)
    )

    const start = Date.now()
    const results = await thread.all(...processors)
    const duration = Date.now() - start

    console.log(`   ✅ Processed ${results.length} records in ${duration}ms`)
    console.log(
      `   ⚡ Rate: ${((results.length / duration) * 1000).toFixed(
        0
      )} records/sec`
    )
    console.log(`   📈 Sample results:`)
    results
      .slice(0, 3)
      .forEach((result, i) =>
        console.log(
          `      Record ${result.id}: score=${result.score.toFixed(
            2
          )}, result=${result.result}`
        )
      )
  } catch (error) {
    console.log('   ❌ Processing failed:', error.message)
  }
}

async function runSimpleLoopExamples() {
  try {
    await simpleThreaderLoop()
    await bypassValidationExample()
    await realWorldExample()
  } catch (error) {
    console.error('❌ Example failed:', error)
  } finally {
    await thread.shutdown()
    console.log('\n✅ Simple Threader loop examples complete!')
  }
}

runSimpleLoopExamples().catch(console.error)
