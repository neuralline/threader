/* tslint:disable */
/* eslint-disable */

/* auto-generated by NAPI-RS */

/** Check if optimized multi-core execution is available */
export declare function isOptimizedMulticoreAvailable(): boolean
/** Get enhanced system information with optimization capabilities */
export declare function getOptimizedMulticoreInfo(): string
/** Enhanced multi-core executor with optimization capabilities */
export declare class OptimizedMultiCoreExecutor {
  /** Create enhanced executor with optimization capabilities */
  constructor(workerCount?: number | undefined | null)
  /** Warm up specific cores for expected workload */
  warmCoresForWorkload(operationType: string, expectedCores: number): void
  /** Submit optimized task with preparation hints */
  submitOptimizedTask(functionCode: string, data: string, optimizationHints: string): string
  /** Submit optimized batch with adaptive sizing */
  submitOptimizedBatch(tasks: Array<[string, string]>, optimizationHints: string): Array<string>
  /** Get optimized result with performance metrics */
  getOptimizedResult(timeoutMs?: number | undefined | null): string
  /** Get batch results with optimization tracking */
  getOptimizedBatchResults(taskCount: number, timeoutMs?: number | undefined | null): Array<string>
  /** Get optimization performance statistics */
  getOptimizationStats(): string
  /** Clear optimization caches and reset stats */
  resetOptimizationState(): void
  get workerCount(): number
  shutdown(): void
}
