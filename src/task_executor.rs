// src/task_executor.rs
use crate::worker_pool::{ WorkerPool, WorkerTask, WorkerPoolError };
use std::sync::Arc;
use thiserror::Error;
use tokio::time::{ timeout, Duration };
use futures::future;

/// Errors that can occur during task execution
#[derive(Error, Debug)]
pub enum TaskExecutorError {
  #[error("Worker pool error: {0}")] WorkerPool(#[from] WorkerPoolError),
  #[error("Task timeout")]
  Timeout,
  #[error("No tasks provided")]
  NoTasks,
}

/// A task to be executed
#[derive(Debug, Clone)]
pub struct Task {
  pub id: String,
  pub function_string: String,
  pub data: serde_json::Value,
  pub timeout: Option<u64>,
}

/// Result of task execution
#[derive(Debug, Clone)]
pub struct TaskResult {
  pub id: String,
  pub result: serde_json::Value,
  pub duration_ms: u64,
  pub error: Option<String>,
}

/// Coordinates task execution across the worker pool
pub struct TaskExecutor {
  default_timeout_ms: u64,
}

impl TaskExecutor {
  /// Create a new task executor
  pub fn new() -> Self {
    Self {
      default_timeout_ms: 30_000, // 30 seconds default
    }
  }

  /// Execute all tasks in parallel and wait for completion (like Promise.all)
  pub async fn execute_all(
    &self,
    worker_pool: &Arc<WorkerPool>,
    tasks: Vec<Task>
  ) -> Result<Vec<TaskResult>, TaskExecutorError> {
    if tasks.is_empty() {
      return Err(TaskExecutorError::NoTasks);
    }

    let futures: Vec<_> = tasks
      .into_iter()
      .map(|task| Box::pin(self.execute_single_task(worker_pool, task)))
      .collect();

    let results = future::try_join_all(futures).await?;
    Ok(results)
  }

  /// Execute tasks and return results as they complete
  pub async fn execute_stream(
    &self,
    worker_pool: &Arc<WorkerPool>,
    tasks: Vec<Task>
  ) -> Result<Vec<TaskResult>, TaskExecutorError> {
    if tasks.is_empty() {
      return Err(TaskExecutorError::NoTasks);
    }

    let futures: Vec<_> = tasks
      .into_iter()
      .map(|task| Box::pin(self.execute_single_task(worker_pool, task)))
      .collect();

    let mut results = Vec::new();
    let mut remaining_futures = futures;

    while !remaining_futures.is_empty() {
      let (result, _index, remaining) = future::select_all(remaining_futures).await;
      remaining_futures = remaining;

      match result {
        Ok(task_result) => results.push(task_result),
        Err(e) => {
          return Err(e);
        }
      }
    }

    Ok(results)
  }

  /// Execute tasks without waiting for results (fire and forget)
  pub fn execute_fire(&self, worker_pool: &Arc<WorkerPool>, tasks: Vec<Task>) {
    for task in tasks {
      let worker_task = WorkerTask {
        id: task.id,
        function_string: task.function_string,
        data: task.data,
        timeout_ms: task.timeout.or(Some(self.default_timeout_ms)),
        response_sender: None, // Fire and forget - no response needed
      };

      let _ = worker_pool.submit_task_fire(worker_task);
    }
  }

  /// Execute tasks and return the first completed result (like Promise.race)
  pub async fn execute_race(
    &self,
    worker_pool: &Arc<WorkerPool>,
    tasks: Vec<Task>
  ) -> Result<TaskResult, TaskExecutorError> {
    if tasks.is_empty() {
      return Err(TaskExecutorError::NoTasks);
    }

    let futures: Vec<_> = tasks
      .into_iter()
      .map(|task| Box::pin(self.execute_single_task(worker_pool, task)))
      .collect();

    let (result, _index, _remaining) = future::select_all(futures).await;
    result
  }

  /// Execute a single task
  async fn execute_single_task(
    &self,
    worker_pool: &Arc<WorkerPool>,
    task: Task
  ) -> Result<TaskResult, TaskExecutorError> {
    let task_timeout = task.timeout.unwrap_or(self.default_timeout_ms);

    let worker_task = WorkerTask {
      id: task.id.clone(),
      function_string: task.function_string,
      data: task.data,
      timeout_ms: Some(task_timeout),
      response_sender: None, // Will be set by submit_task
    };

    let pool_result = (if task_timeout > 0 {
      timeout(
        Duration::from_millis(task_timeout),
        worker_pool.submit_task(worker_task)
      ).await.map_err(|_| TaskExecutorError::Timeout)?
    } else {
      worker_pool.submit_task(worker_task).await
    })?;

    // Convert pool result to task result
    let task_result = match pool_result.result {
      Ok(result) =>
        TaskResult {
          id: pool_result.id,
          result,
          duration_ms: pool_result.duration_ms,
          error: None,
        },
      Err(error) =>
        TaskResult {
          id: pool_result.id,
          result: serde_json::Value::Null,
          duration_ms: pool_result.duration_ms,
          error: Some(error),
        },
    };

    Ok(task_result)
  }

  /// Set the default timeout for tasks
  pub fn set_default_timeout(&mut self, timeout_ms: u64) {
    self.default_timeout_ms = timeout_ms;
  }

  /// Get the default timeout
  pub fn get_default_timeout(&self) -> u64 {
    self.default_timeout_ms
  }
}
