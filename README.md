# Threader

> Neural Line - True Multi-Core JavaScript Parallelism.

> **THREADER** ~/`threh·duh`/  
> Version 0.1.0

## Overview

Threader enables **genuine multi-core parallelism** for JavaScript applications by distributing complete V8 instances across CPU cores. Built for **heavy computational workloads** where true parallel processing delivers significant performance gains.

## Performance Highlights

- **True multi-core execution** across all available CPU cores
- **2-4x speedup** for CPU-intensive operations taking >100ms
- **~100 operations/second** sustained throughput with 10ms coordination overhead
- **Linear scaling** with heavy workloads (proven with 32s → 15s improvements)
- **Hybrid Rust + JavaScript** execution for optimal performance

## Core Philosophy

**"2-Phase Optimization: Prepare Once, Execute Fast"**

### Phase 1: `threader()` - Preparation & Optimization

- Function analysis and JIT optimization hints
- Binary protocol data serialization
- Adaptive batching strategy calculation
- Backend routing decisions (Rust vs JavaScript workers)
- Hot function detection and caching

### Phase 2: `thread.*` - Optimized Execution

- Lightning-fast execution using pre-optimized data
- True parallelism across CPU cores
- Smart routing based on optimization hints
- Performance learning for future improvements

## Quick Start

```bash
npm install threader
```

```javascript
import {threader, thread} from 'threader'

// Phase 1: Create optimized processors (prepare once)
const processor1 = threader(x => heavyComputation(x), data1)
const processor2 = threader(x => complexAnalysis(x), data2)
const processor3 = threader(x => imageProcessing(x), data3)

// Phase 2: Execute across cores (fast execution)
const results = await thread.all(processor1, processor2, processor3)
console.log(results) // [result1, result2, result3]
```

## Real-World Performance

### Proven Performance Gains

```javascript
// Matrix Operations: 2.2x speedup
Sequential: 32.8s → Parallel: 15.2s (17.6s saved)

// Image Processing: 2.0x speedup
Sequential: 19.0s → Parallel: 9.7s (9.3s saved)

// Data Analysis: 1.9x speedup
Sequential: 11.3s → Parallel: 5.8s (5.5s saved)

// Monte Carlo Simulations: 2.1x speedup
Sequential: 2.8s → Parallel: 1.4s (1.5s saved)

// Overall: 105% faster (33.8s total time saved)
```

### Throughput Characteristics

- **Sustained throughput**: ~100 operations/second
- **Coordination overhead**: ~10ms per operation
- **Break-even point**: Operations taking >10ms each
- **Sweet spot**: Operations taking >100ms each
- **Maximum efficiency**: 2-4x speedup on multi-core systems

## API Reference

### Execution Strategies

#### `thread.all()`

Wait for all tasks to complete (like Promise.all)

```javascript
const results = await thread.all(processor1, processor2, processor3)
// Returns: [result1, result2, result3]
```

#### `thread.stream()`

Process results as they complete (async iterator)

```javascript
for await (const result of thread.stream(processor1, processor2, processor3)) {
  console.log('Completed:', result.result)
  // Handle results progressively as they finish
}
```

#### `thread.fire()`

Fire and forget - execute without waiting for results

```javascript
thread.fire(processor1, processor2, processor3)
// Returns immediately, tasks run in background
```

#### `thread.race()`

Return first completed result (like Promise.race)

```javascript
const winner = await thread.race(processor1, processor2, processor3)
// Returns: { index: 0, result: value, duration: 5 }
```

#### `thread.any(n)`

Return first N completed results

```javascript
const firstTwo = await thread.any(2, processor1, processor2, processor3)
// Returns: [result1, result2] (first two to complete)
```

## When to Use Threader

### ✅ EXCELLENT Use Cases (2-4x speedup)

```javascript
// Prime number generation (CPU-intensive)
const primeProcessor = threader(
  range => generatePrimes(range.start, range.end),
  {start: 100000, end: 200000}
)

// Image processing (heavy filters)
const imageProcessor = threader(
  imageData => applyComplexFilters(imageData),
  largeImageBuffer
)

// Mathematical computations (matrix operations)
const matrixProcessor = threader(
  matrices => multiplyLargeMatrices(matrices.a, matrices.b),
  {a: matrix1000x1000, b: matrix1000x1000}
)

// Data analysis (statistical computations)
const analysisProcessor = threader(
  dataset => complexStatisticalAnalysis(dataset),
  millionDataPoints
)

// Monte Carlo simulations
const simulationProcessor = threader(
  params => runMonteCarloSimulation(params.iterations),
  {iterations: 10000000}
)
```

**Characteristics**: Operations taking >100ms each, CPU-bound, parallelizable

### ⚠️ AVOID For (87,000x overhead)

```javascript
// ❌ Simple arithmetic
threader(x => x * 2, 10) // Use: x * 2

// ❌ Basic string operations
threader(s => s.toUpperCase(), 'hi') // Use: s.toUpperCase()

// ❌ Small array operations
threader(arr => arr.sum(), [1, 2, 3]) // Use: arr.reduce()

// ❌ I/O operations
threader(url => fetch(url), '/api') // Use: Promise.all()
```

**Characteristics**: Operations taking <10ms each, I/O-bound, simple computations

## Performance Guidelines

### Decision Framework

1. **Is it CPU-intensive?** (Yes = consider Threader)
2. **Does each operation take >10ms?** (Yes = good candidate)
3. **Do you have multiple independent tasks?** (Yes = parallel benefit)
4. **Is it I/O bound?** (Yes = use Promise.all instead)

### Optimal Usage Patterns

```javascript
// ✅ Batch heavy operations
const processors = heavyDatasets.map(data => threader(complexAnalysis, data))
const results = await thread.all(...processors)

// ✅ Reuse processors for repeated work
const imageProcessor = threader(processImage, imageConfig)
const batch1 = await thread.all(...images1.map(() => imageProcessor))
const batch2 = await thread.all(...images2.map(() => imageProcessor))

// ✅ Stream results for progressive feedback
for await (const result of thread.stream(...processors)) {
  updateProgressBar(result)
  handleResult(result.result)
}
```

### Performance Expectations

| Operation Duration | Threader Overhead | Recommendation         |
| ------------------ | ----------------- | ---------------------- |
| <1ms               | 10,000%+          | ❌ Never use           |
| 1-10ms             | 100-1000%         | ❌ Too much overhead   |
| 10-50ms            | 20-100%           | ⚠️ Marginal benefit    |
| 50-100ms           | 10-20%            | ✅ Good candidate      |
| >100ms             | <10%              | ✅ Excellent candidate |

## Architecture

### 2-Phase Optimization Pipeline

**Phase 1 (`threader()`)**: Preparation happens once

- Binary protocol analysis and data pre-serialization
- Function analysis with JIT optimization hints
- Adaptive batching strategy calculation
- Backend routing decisions (Rust vs JavaScript workers)
- Hot function detection and performance caching

**Phase 2 (`thread.*`)**: Optimized execution happens fast

- Smart routing based on pre-calculated optimization hints
- True parallelism using worker threads across CPU cores
- Performance learning and adaptation over time

### Backend Architecture

- **🦀 Rust coordination layer**: Ultra-fast task distribution and management
- **🟨 V8 worker instances**: Full JavaScript environment per CPU core
- **📦 Complete library support**: All npm packages work normally
- **🔄 Automatic fallback**: JavaScript workers if Rust backend unavailable

## Advanced Features

### Configuration

```javascript
// Global configuration
thread.configure({
  maxWorkers: 8,
  timeout: 30000,
  enableValidation: true
})

// Per-task configuration
const processor = threader(func, data, {
  timeout: 10000,
  preferBinary: true,
  batchHint: 'large'
})
```

### Performance Monitoring

```javascript
// Get optimization statistics
const stats = thread.getOptimizationStats()
console.log(stats.cacheStats) // Function analysis cache info
console.log(stats.hotFunctions) // Hot function detection

// Benchmark your functions
const benchmark = benchmark(myFunction, testData, 1000)
console.log(benchmark.direct.opsPerSec) // Direct execution speed
```

### Error Handling

```javascript
try {
  const results = await thread.all(processor1, processor2)
} catch (error) {
  if (error instanceof ThreadValidationError) {
    console.log('Function validation failed:', error.message)
  } else if (error instanceof ThreadTimeoutError) {
    console.log('Task timed out:', error.message)
  }
}
```

## Real-World Examples

### Heavy Mathematical Computation

```javascript
// Parallel prime number generation across ranges
const primeRanges = [
  {start: 1, end: 100000},
  {start: 100001, end: 200000},
  {start: 200001, end: 300000},
  {start: 300001, end: 400000}
]

const primeProcessors = primeRanges.map(range =>
  threader(r => {
    const primes = []
    for (let num = r.start; num <= r.end; num++) {
      let isPrime = true
      for (let i = 2; i <= Math.sqrt(num); i++) {
        if (num % i === 0) {
          isPrime = false
          break
        }
      }
      if (isPrime) primes.push(num)
    }
    return primes
  }, range)
)

// 2.2x speedup: 32.8s → 15.2s
const allPrimes = await thread.all(...primeProcessors)
```

### Image Processing Pipeline

```javascript
// Parallel image processing with heavy filters
const imageProcessors = images.map(imageData =>
  threader(img => {
    // Apply multiple heavy filters
    let processed = img

    // 10 passes of complex filters
    for (let pass = 0; pass < 10; pass++) {
      processed = applyBlurFilter(processed)
      processed = applySharpenFilter(processed)
      processed = applyColorCorrection(processed)
    }

    return processed
  }, imageData)
)

// 2.0x speedup: 19.0s → 9.7s
const processedImages = await thread.all(...imageProcessors)
```

### Real-Time Data Analysis

```javascript
// Stream results as large datasets complete analysis
const datasetProcessors = largeDataseets.map(dataset =>
  threader(data => {
    // Heavy statistical analysis
    const mean = data.reduce((a, b) => a + b, 0) / data.length
    const variance =
      data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length

    // Complex correlation analysis
    const correlations = computeCorrelationMatrix(data)

    return {
      mean,
      variance,
      correlations,
      outliers: detectOutliers(data),
      trends: detectTrends(data)
    }
  }, dataset)
)

// 1.9x speedup with progressive results
for await (const result of thread.stream(...datasetProcessors)) {
  updateDashboard(result.result)
  console.log(`Analysis ${result.index + 1} complete`)
}
```

## Installation & Setup

### NPM Installation

```bash
npm install threader
```

### Automatic Setup

- Rust backend builds automatically during installation
- Graceful fallback to JavaScript workers if Rust unavailable
- Zero configuration required - works out of the box

### Build from Source

```bash
git clone https://github.com/neuralline/threader
cd threader
npm install
npm run build
```

## Platform Support

- **Node.js 16+** (primary target)
- **Cross-platform**: macOS, Linux, Windows
- **Multi-architecture**: x64, ARM64
- **Rust acceleration** on supported platforms with automatic fallback

## Benchmarks

Run the included benchmarks to see performance on your system:

```bash
# Heavy workload benchmark (shows 2-4x speedups)
npm run bench:heavy

# Overhead analysis (shows when to use vs avoid)
npm run bench:overhead

# Throughput analysis (shows ~100 ops/sec capability)
npm run bench:throughput
```

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/neuralline/threader/issues)
- **Discussions**: [GitHub Discussions](https://github.com/neuralline/threader/discussions)

---

```sh
Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0
N0.0E0.0U0.0R0.00A.0L0 - L0.0I0.0N0.0E0
THREADING MULTI CORE CONCURRENCY
```

**Threader** - Neural Line true multi-core JavaScript parallelism for heavy computational workloads
_2-4x speedup where it matters most._
