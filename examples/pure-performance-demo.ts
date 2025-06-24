// examples/pure-performance-demo.ts
import {threader, thread} from '../src/index'

// Demo 1: Mandelbrot Set Calculation
async function mandelbrotDemo() {
  console.log('🌀 === MANDELBROT SET PARALLEL CALCULATION ===')
  console.log('Computing fractal using all CPU cores...\n')

  const width = 800
  const height = 600
  const maxIterations = 100
  const chunks = 8

  console.log(`🖼️  Rendering ${width}x${height} Mandelbrot fractal`)
  console.log(`⚡ Using ${chunks} parallel workers`)
  console.log(`🔢 Max iterations: ${maxIterations}\n`)

  const start = Date.now()

  // Split image into horizontal strips
  const rowsPerChunk = Math.ceil(height / chunks)
  const workers = Array.from({length: chunks}, (_, chunkIndex) => {
    const startRow = chunkIndex * rowsPerChunk
    const endRow = Math.min(startRow + rowsPerChunk, height)

    return threader(
      (data: any) => {
        const {width, height, startRow, endRow, maxIterations} = data
        const results = []

        for (let y = startRow; y < endRow; y++) {
          const row = []
          for (let x = 0; x < width; x++) {
            // Map pixel to complex plane
            const real = ((x - width / 2) * 4) / width
            const imag = ((y - height / 2) * 4) / height

            // Calculate Mandelbrot iterations
            let zReal = 0,
              zImag = 0
            let iterations = 0

            while (
              iterations < maxIterations &&
              zReal * zReal + zImag * zImag < 4
            ) {
              const newReal = zReal * zReal - zImag * zImag + real
              zImag = 2 * zReal * zImag + imag
              zReal = newReal
              iterations++
            }

            row.push(iterations)
          }
          results.push(row)
        }

        return {startRow, endRow, data: results}
      },
      {width, height, startRow, endRow, maxIterations}
    )
  })

  const results = await thread.all(...workers)
  const duration = Date.now() - start

  // Combine results
  const fractal = new Array(height)
  results
    .sort((a, b) => a.startRow - b.startRow)
    .forEach(chunk => {
      chunk.data.forEach((row: number[], index: number) => {
        fractal[chunk.startRow + index] = row
      })
    })

  const totalPixels = width * height
  const totalIterations = fractal.flat().reduce((sum, iter) => sum + iter, 0)

  console.log(`✅ Mandelbrot calculation complete!`)
  console.log(`🖼️  Pixels computed: ${totalPixels.toLocaleString()}`)
  console.log(`🔢 Total iterations: ${totalIterations.toLocaleString()}`)
  console.log(`⚡ Time: ${duration}ms`)
  console.log(
    `🚀 Performance: ${(
      (totalPixels / duration) *
      1000
    ).toLocaleString()} pixels/second`
  )
  console.log(
    `💫 Average iterations per pixel: ${(totalIterations / totalPixels).toFixed(
      1
    )}\n`
  )
}

// Demo 2: Parallel Sorting Race
async function sortingRaceDemo() {
  console.log('🏁 === PARALLEL SORTING ALGORITHM RACE ===')
  console.log('Different sorting algorithms racing on the same data...\n')

  // Generate large random dataset
  const dataSize = 100000
  const originalData = Array.from({length: dataSize}, () =>
    Math.floor(Math.random() * dataSize)
  )

  console.log(`📊 Dataset size: ${dataSize.toLocaleString()} numbers`)
  console.log(`🏁 Racing 6 different sorting algorithms...\n`)

  const sortingAlgorithms = [
    {
      name: 'Quick Sort',
      algo: threader(
        (data: number[]) => {
          function quickSort(arr: number[]): number[] {
            if (arr.length <= 1) return arr

            const pivot = arr[Math.floor(arr.length / 2)]
            const left = arr.filter(x => x < pivot)
            const middle = arr.filter(x => x === pivot)
            const right = arr.filter(x => x > pivot)

            return [...quickSort(left), ...middle, ...quickSort(right)]
          }
          return quickSort([...data])
        },
        [...originalData]
      )
    },
    {
      name: 'Merge Sort',
      algo: threader(
        (data: number[]) => {
          function mergeSort(arr: number[]): number[] {
            if (arr.length <= 1) return arr

            const mid = Math.floor(arr.length / 2)
            const left = mergeSort(arr.slice(0, mid))
            const right = mergeSort(arr.slice(mid))

            const result = []
            let i = 0,
              j = 0

            while (i < left.length && j < right.length) {
              if (left[i] <= right[j]) {
                result.push(left[i++])
              } else {
                result.push(right[j++])
              }
            }

            return [...result, ...left.slice(i), ...right.slice(j)]
          }
          return mergeSort([...data])
        },
        [...originalData]
      )
    },
    {
      name: 'Heap Sort',
      algo: threader(
        (data: number[]) => {
          function heapSort(arr: number[]): number[] {
            const result = [...arr]

            function heapify(arr: number[], n: number, i: number) {
              let largest = i
              const left = 2 * i + 1
              const right = 2 * i + 2

              if (left < n && arr[left] > arr[largest]) largest = left
              if (right < n && arr[right] > arr[largest]) largest = right

              if (largest !== i) {
                ;[arr[i], arr[largest]] = [arr[largest], arr[i]]
                heapify(arr, n, largest)
              }
            }

            for (let i = Math.floor(result.length / 2) - 1; i >= 0; i--) {
              heapify(result, result.length, i)
            }

            for (let i = result.length - 1; i > 0; i--) {
              ;[result[0], result[i]] = [result[i], result[0]]
              heapify(result, i, 0)
            }

            return result
          }
          return heapSort(data)
        },
        [...originalData]
      )
    },
    {
      name: 'Built-in Sort',
      algo: threader(
        (data: number[]) => {
          return [...data].sort((a, b) => a - b)
        },
        [...originalData]
      )
    },
    {
      name: 'Radix Sort',
      algo: threader(
        (data: number[]) => {
          function radixSort(arr: number[]): number[] {
            const result = [...arr]
            const max = Math.max(...result)

            for (let exp = 1; Math.floor(max / exp) > 0; exp *= 10) {
              const output = new Array(result.length)
              const count = new Array(10).fill(0)

              for (let i = 0; i < result.length; i++) {
                count[Math.floor(result[i] / exp) % 10]++
              }

              for (let i = 1; i < 10; i++) {
                count[i] += count[i - 1]
              }

              for (let i = result.length - 1; i >= 0; i--) {
                const digit = Math.floor(result[i] / exp) % 10
                output[count[digit] - 1] = result[i]
                count[digit]--
              }

              for (let i = 0; i < result.length; i++) {
                result[i] = output[i]
              }
            }

            return result
          }
          return radixSort(data)
        },
        [...originalData]
      )
    },
    {
      name: 'Bubble Sort',
      algo: threader(
        (data: number[]) => {
          const result = [...data]
          for (let i = 0; i < result.length; i++) {
            for (let j = 0; j < result.length - i - 1; j++) {
              if (result[j] > result[j + 1]) {
                ;[result[j], result[j + 1]] = [result[j + 1], result[j]]
              }
            }
          }
          return result
        },
        [...originalData]
      )
    }
  ]

  console.log('🚀 Starting the race...\n')

  let position = 1
  const results: any[] = []

  for await (const result of thread.stream(
    ...sortingAlgorithms.map(alg => alg.algo)
  )) {
    const algorithmName = sortingAlgorithms[result.index].name
    results.push({
      name: algorithmName,
      time: result.duration,
      position
    })

    console.log(`🏆 #${position} ${algorithmName} - ${result.duration}ms`)
    position++
  }

  console.log(`\n🏁 RACE RESULTS:`)
  results
    .sort((a, b) => a.time - b.time)
    .forEach((result, index) => {
      const medal = ['🥇', '🥈', '🥉'][index] || '🏅'
      console.log(`${medal} ${result.name}: ${result.time}ms`)
    })

  const fastest = results[0]
  const slowest = results[results.length - 1]
  console.log(`\n⚡ Fastest was ${fastest.time}ms faster than slowest`)
  console.log(
    `🚀 Speed difference: ${(slowest.time / fastest.time).toFixed(1)}x\n`
  )
}

// Demo 3: Cryptographic Hash Competition
async function hashCompetitionDemo() {
  console.log('🔐 === CRYPTOGRAPHIC HASH COMPUTATION RACE ===')
  console.log('Parallel hash computation using different algorithms...\n')

  const inputData = 'Threader-Performance-Test-' + '0'.repeat(1000) // 1KB of data
  const iterations = 10000

  console.log(`📝 Input size: ${inputData.length} bytes`)
  console.log(`🔄 Iterations per algorithm: ${iterations.toLocaleString()}`)
  console.log(`🏁 Racing hash algorithms...\n`)

  const hashAlgorithms = [
    {
      name: 'SHA-256',
      hasher: threader(
        (data: {input: string; iterations: number}) => {
          const crypto = require('crypto')
          let result = data.input
          for (let i = 0; i < data.iterations; i++) {
            result = crypto.createHash('sha256').update(result).digest('hex')
          }
          return {finalHash: result, iterations: data.iterations}
        },
        {input: inputData, iterations}
      )
    },
    {
      name: 'SHA-1',
      hasher: threader(
        (data: {input: string; iterations: number}) => {
          const crypto = require('crypto')
          let result = data.input
          for (let i = 0; i < data.iterations; i++) {
            result = crypto.createHash('sha1').update(result).digest('hex')
          }
          return {finalHash: result, iterations: data.iterations}
        },
        {input: inputData, iterations}
      )
    },
    {
      name: 'MD5',
      hasher: threader(
        (data: {input: string; iterations: number}) => {
          const crypto = require('crypto')
          let result = data.input
          for (let i = 0; i < data.iterations; i++) {
            result = crypto.createHash('md5').update(result).digest('hex')
          }
          return {finalHash: result, iterations: data.iterations}
        },
        {input: inputData, iterations}
      )
    }
  ]

  let position = 1
  for await (const result of thread.stream(
    ...hashAlgorithms.map(alg => alg.hasher)
  )) {
    const algorithmName = hashAlgorithms[result.index].name
    const hashesPerSecond = (
      (iterations / result.duration) *
      1000
    ).toLocaleString()

    console.log(`🏆 #${position} ${algorithmName}`)
    console.log(`   ⏱️  Time: ${result.duration}ms`)
    console.log(`   ⚡ Rate: ${hashesPerSecond} hashes/second`)
    console.log(
      `   🔗 Final hash: ${result.result.finalHash.substring(0, 16)}...`
    )
    console.log()

    position++
  }
}

// Main demo runner
async function runPurePerformanceDemos() {
  console.log('⚡ THREADER PURE PERFORMANCE SHOWCASE')
  console.log('=====================================\n')

  try {
    await mandelbrotDemo()
    await sortingRaceDemo()
    await hashCompetitionDemo()

    console.log('🎉 PURE PERFORMANCE DEMOS COMPLETED!')
    console.log('⚡ Your CPU cores have been CRUSHED by Threader!')
  } catch (error) {
    console.error('❌ Demo failed:', error)
  } finally {
    await thread.shutdown()
    console.log('\n✅ Performance showcase complete!')
  }
}

runPurePerformanceDemos().catch(console.error)
