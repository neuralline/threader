# Threader - Multi-Core JavaScript Parallelism Plugin

## Overview

Threader is a JavaScript plugin that enables true multi-core parallelism for CPU-intensive tasks. It provides a simple, Promise-like API for distributing pure functions across available CPU cores, similar to how `Promise.all` works but with actual parallel execution.

## Core Concept

**Simple Mental Model**: "For loop + async Promise but on multi-core"

- `threader()` - Creates a unit of parallel work (function + data)
- `thread.*` - Executes units with different strategies (all, stream, fire)
- Each execution runs independently with no shared state (pure functional)

## API Design

### Basic Usage

```javascript
// Create work units
const processor1 = threader(func1, data1)
const processor2 = threader(func2, data2)
const processor3 = threader(func3, data3)

// Execute with different strategies
await thread.all(processor1, processor2, processor3) // Wait for all
thread.stream(processor1, processor2, processor3) // Process as available
thread.fire(processor1, processor2, processor3) // Fire and forget
```

### Execution Strategies

1. **`thread.all()`** - Wait for all to complete (like Promise.all)
2. **`thread.stream()`** - Return results as they complete (async iterator)
3. **`thread.fire()`** - Fire and forget, no return value
4. **`thread.race()`** - Return first to complete
5. **`thread.any(n)`** - Return first N to complete

### Advanced Features

```javascript
// Cancellation support
const controller = await thread.all(processor1, processor2)
controller.cancel()
processor1.cancel() // Individual cancellation

// Status monitoring
processor1.status // 'pending', 'running', 'completed', 'cancelled'
processor1.progress // Progress if supported
processor1.result // Result when completed
```

## Architecture

### Core Components

#### 1. Worker Pool Manager

- **Purpose**: Manage a pool of worker threads equal to CPU cores
- **Responsibilities**:
  - Initialize worker threads on first use
  - Distribute tasks across available workers
  - Load balancing with work-stealing queues
  - Worker lifecycle management (spawn, reuse, cleanup)

#### 2. Task Serializer

- **Purpose**: Safely transfer functions and data to worker threads
- **Responsibilities**:
  - Function serialization and validation
  - Data cloning/transfer optimization
  - Dependency injection for worker context
  - Error handling for unsupported function types

#### 3. Execution Controller

- **Purpose**: Coordinate different execution strategies
- **Responsibilities**:
  - Strategy implementation (all, stream, fire, race)
  - Result collection and ordering
  - Error propagation and handling
  - Cancellation management

#### 4. Pure Function Validator

- **Purpose**: Ensure functions are safe for parallel execution
- **Responsibilities**:
  - Static analysis for side effects
  - Runtime validation
  - Whitelist/blacklist of allowed operations
  - Clear error messages for violations

### System Flow

1. **Task Creation**: `threader(func, data)` creates a serializable task
2. **Function Validation**: Ensure function is pure and transferable
3. **Worker Assignment**: Assign task to available worker from pool
4. **Execution**: Worker executes function with data in isolated context
5. **Result Collection**: Collect results based on execution strategy
6. **Cleanup**: Return worker to pool, handle errors/cancellation

## Technical Implementation

### Worker Thread Communication

```javascript
// Main thread to worker
{
  type: 'EXECUTE_TASK',
  taskId: 'unique-id',
  function: serializedFunction,
  data: clonedData,
  transferables: [...ArrayBuffers]
}

// Worker to main thread
{
  type: 'TASK_COMPLETE',
  taskId: 'unique-id',
  result: processedData,
  error: null
}
```

### Memory Management

- **Structured Cloning**: For complex objects
- **Transferable Objects**: For ArrayBuffers, MessagePorts
- **SharedArrayBuffer**: For large datasets (when available)
- **Garbage Collection**: Proper cleanup of worker memory

### Error Handling

- **Function Validation Errors**: Clear messages for non-pure functions
- **Runtime Errors**: Proper error propagation from workers
- **Worker Crashes**: Automatic worker replacement and task retry
- **Timeout Handling**: Configurable timeouts for long-running tasks

## Pure Function Requirements

### Allowed Operations

- Mathematical computations
- Data transformations
- String/array/object manipulation
- JSON parsing/serialization
- Regular expressions

### Prohibited Operations

- Global variable access/modification
- File system operations
- Network requests (fetch, XMLHttpRequest)
- DOM manipulation
- Console output (in strict mode)
- Timer functions (setTimeout, setInterval)
- Random number generation (unless seeded)

### Validation Strategy

```javascript
// Static analysis patterns
const SIDE_EFFECT_PATTERNS = [
  /console\./,
  /fetch\(/,
  /XMLHttpRequest/,
  /localStorage/,
  /sessionStorage/,
  /document\./,
  /window\./
]

// Runtime checks
function validateFunction(func) {
  const funcString = func.toString()
  for (const pattern of SIDE_EFFECT_PATTERNS) {
    if (pattern.test(funcString)) {
      throw new Error(`Side effect detected: ${pattern}`)
    }
  }
}
```

## Performance Optimizations

### Function Caching

- Serialize functions once per threader instance
- Cache serialized functions in worker threads
- Reuse workers for same function types

### Data Transfer Optimization

- Detect transferable objects automatically
- Use SharedArrayBuffer for large read-only data
- Batch small operations to reduce communication overhead

### Worker Pool Strategies

- **Pre-warming**: Initialize workers on first use
- **Keep-alive**: Maintain workers between tasks
- **Auto-scaling**: Adjust pool size based on workload
- **Work-stealing**: Balance load across workers

## Configuration Options

```javascript
// Global configuration
threader.config({
  maxWorkers: navigator.hardwareConcurrency,
  workerTimeout: 30000,
  enableValidation: true,
  transferMode: 'auto' // 'clone', 'transfer', 'shared'
})

// Per-instance configuration
const processor = threader(func, data, {
  timeout: 10000,
  priority: 'high',
  retries: 3
})
```

## TODO List

### Phase 1: Core Implementation

- [ ] Set up project structure and build system
- [ ] Implement basic Worker Pool Manager
- [ ] Create Task Serializer with function validation
- [ ] Build basic `thread.all()` execution strategy
- [ ] Add error handling and worker crash recovery
- [ ] Write comprehensive tests for core functionality

### Phase 2: Execution Strategies

- [ ] Implement `thread.stream()` with async iteration
- [ ] Add `thread.fire()` fire-and-forget mode
- [ ] Build `thread.race()` and `thread.any()` strategies
- [ ] Add cancellation support for all strategies
- [ ] Implement progress tracking and status monitoring

### Phase 3: Optimization

- [ ] Add function caching and reuse optimization
- [ ] Implement data transfer optimization (transferables, SharedArrayBuffer)
- [ ] Build work-stealing queue for load balancing
- [ ] Add performance monitoring and metrics
- [ ] Optimize memory usage and garbage collection

### Phase 4: Advanced Features

- [ ] Add comprehensive pure function validation
- [ ] Implement configuration system
- [ ] Build debugging and profiling tools
- [ ] Add TypeScript definitions
- [ ] Create browser and Node.js compatibility layers

### Phase 5: Documentation & Testing

- [ ] Write comprehensive API documentation
- [ ] Create usage examples and tutorials
- [ ] Build performance benchmarks
- [ ] Add integration tests for real-world scenarios
- [ ] Set up CI/CD pipeline

### Phase 6: Ecosystem

- [ ] Create plugins for common use cases (image processing, data analysis)
- [ ] Build dev tools and browser extensions
- [ ] Add framework integrations (React, Vue, etc.)
- [ ] Create online playground and examples
- [ ] Publish to npm and CDN

## Technical Challenges

### Function Serialization

- **Challenge**: Transferring closures and scope across threads
- **Solution**: Static analysis + controlled environment injection

### Memory Management

- **Challenge**: Efficient data transfer without excessive copying
- **Solution**: Smart detection of transferable objects + SharedArrayBuffer

### Error Boundary

- **Challenge**: Isolating worker errors from main thread
- **Solution**: Comprehensive error categorization + graceful degradation

### Browser Compatibility

- **Challenge**: Worker support varies across browsers/environments
- **Solution**: Feature detection + fallback to single-threaded execution

## Success Metrics

### Performance Goals

- 90%+ CPU utilization on multi-core systems
- <10ms overhead for task distribution
- Linear scaling with CPU core count
- Memory usage <2x single-threaded equivalent

### Developer Experience Goals

- <5 minutes to get started with basic example
- Intuitive API that feels like native JavaScript
- Clear error messages for common mistakes
- Comprehensive documentation and examples
