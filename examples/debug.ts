// debug-rust.js
const fs = require('fs')
const path = require('path')

console.log('🔍 Debugging Rust Backend Loading...\n')

// Check for .node files
console.log('Looking for .node files:')
const files = fs.readdirSync('.')
const nodeFiles = files.filter(f => f.endsWith('.node'))
console.log('Found .node files:', nodeFiles)

if (nodeFiles.length === 0) {
  console.log('❌ No .node files found. Run: npm run build:rust')
  process.exit(1)
}

// Try to load each .node file
for (const file of nodeFiles) {
  try {
    console.log(`\nTrying to load: ${file}`)
    const rust = require(`../${file}`)
    console.log('✅ Loaded successfully!')
    console.log('Available exports:', Object.keys(rust))

    if (rust.isRustAvailable) {
      console.log('isRustAvailable:', rust.isRustAvailable())
    }

    if (rust.getSystemInfo) {
      console.log('System info:', rust.getSystemInfo())
    }

    if (rust.SimpleThreader) {
      console.log('Testing SimpleThreader...')
      const threader = new rust.SimpleThreader()
      console.log('CPU count:', threader.cpuCount)

      const result = threader.executeSimple('x => x * 2', JSON.stringify(42))
      console.log('Test execution result:', JSON.parse(result))
    }
  } catch (error) {
    console.log(`❌ Failed to load ${file}:`, error.message)
  }
}

// Check index.js
console.log('\n📋 Checking index.js...')
try {
  if (fs.existsSync('index.js')) {
    const indexRust = require('../index.js')
    console.log('✅ index.js loaded')
    console.log('Exports:', Object.keys(indexRust))
  } else {
    console.log('❌ index.js not found')
  }
} catch (error) {
  console.log('❌ index.js load error:', error.message)
}

console.log('\n🔧 Suggested fixes:')
console.log('1. Ensure Rust build completed: npm run build:rust')
console.log('2. Copy binary to expected name: cp threader.*.node threader.node')
console.log('3. Check if binary matches your platform')
