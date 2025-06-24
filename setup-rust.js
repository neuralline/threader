// setup-rust.js
const fs = require('fs')
const path = require('path')

console.log('🔧 Setting up Rust backend...')

// Find platform-specific .node file
const files = fs.readdirSync('.')
const nodeFile = files.find(
  f => f.startsWith('threader.') && f.endsWith('.node')
)

if (!nodeFile) {
  console.log('❌ No .node file found. Run: npm run build:rust')
  process.exit(1)
}

console.log(`Found: ${nodeFile}`)

// Copy to generic name for easier loading
const genericName = 'threader.node'
if (nodeFile !== genericName) {
  try {
    fs.copyFileSync(nodeFile, genericName)
    console.log(`✅ Copied ${nodeFile} to ${genericName}`)
  } catch (error) {
    console.log(`❌ Failed to copy: ${error.message}`)
    process.exit(1)
  }
} else {
  console.log('✅ Already using generic name')
}

// Test loading
try {
  const rust = require('./threader.node')
  if (rust.isRustAvailable && rust.isRustAvailable()) {
    console.log('✅ Rust backend test successful!')
    console.log(`CPU cores detected: ${new rust.SimpleThreader().cpuCount}`)
  } else {
    console.log('❌ Rust backend test failed')
  }
} catch (error) {
  console.log('❌ Could not load Rust backend:', error.message)
}

console.log('🎉 Setup complete!')
