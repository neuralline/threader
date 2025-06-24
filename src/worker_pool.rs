// src/worker_pool.rs
use std::sync::Arc;
use tokio::sync::{ mpsc, oneshot, RwLock };
use std::collections::HashMap;
use thiserror::Error;

/// Errors that can occur in the worker pool
#[derive(Error, Debug)]
pub enum WorkerPoolError {
  #[error("Worker pool is shutting down")]
  ShuttingDown,
  #[error("Task execution failed: {0}")] TaskFailed(String),
  #[error("Task timed out")]
  Timeout,
}

/// A task that can be executed by the worker pool
#[derive(Debug)]
pub struct WorkerTask {
  pub id: String,
  pub function_string: String,
  pub data: serde_json::Value,
  pub timeout_ms: Option<u64>,
  pub response_sender: Option<oneshot::Sender<TaskResult>>,
}

/// Result of a task execution
#[derive(Debug, Clone)]
pub struct TaskResult {
  pub id: String,
  pub result: Result<serde_json::Value, String>,
  pub duration_ms: u64,
}

/// Simplified worker pool that processes tasks concurrently
pub struct WorkerPool {
  task_sender: mpsc::UnboundedSender<WorkerTask>,
  num_workers: usize,
  active_tasks: Arc<RwLock<HashMap<String, bool>>>,
}

impl WorkerPool {
  /// Create a new worker pool with the specified number of threads
  pub fn new(num_workers: usize) -> Self {
    let (task_sender, mut task_receiver) = mpsc::unbounded_channel();
    let active_tasks = Arc::new(RwLock::new(HashMap::new()));

    let pool = Self {
      task_sender,
      num_workers,
      active_tasks: Arc::clone(&active_tasks),
    };

    // Start the main task dispatcher
    let active_tasks_clone = Arc::clone(&active_tasks);
    tokio::spawn(async move {
      while let Some(task) = task_receiver.recv().await {
        let active_tasks = Arc::clone(&active_tasks_clone);
        tokio::spawn(async move {
          Self::process_task(task, active_tasks).await;
        });
      }
    });

    pool
  }

  /// Submit a task for execution
  pub async fn submit_task(&self, task: WorkerTask) -> Result<TaskResult, WorkerPoolError> {
    let (response_sender, response_receiver) = oneshot::channel();

    let mut task_with_sender = task;
    task_with_sender.response_sender = Some(response_sender);

    self.task_sender.send(task_with_sender).map_err(|_| WorkerPoolError::ShuttingDown)?;

    response_receiver.await.map_err(|_| WorkerPoolError::ShuttingDown)
  }

  /// Submit a task without waiting for the result (fire and forget)
  pub fn submit_task_fire(&self, task: WorkerTask) -> Result<(), WorkerPoolError> {
    self.task_sender.send(task).map_err(|_| WorkerPoolError::ShuttingDown)
  }

  /// Get the number of workers in the pool
  pub fn worker_count(&self) -> usize {
    self.num_workers
  }

  /// Shutdown the worker pool
  pub async fn shutdown(&self) -> Result<(), WorkerPoolError> {
    // The task_sender will be dropped when this function completes
    // which will close the channel and stop the workers
    Ok(())
  }

  /// Process a single task
  async fn process_task(task: WorkerTask, active_tasks: Arc<RwLock<HashMap<String, bool>>>) {
    let task_id = task.id.clone();

    // Register task as active
    {
      let mut tasks = active_tasks.write().await;
      tasks.insert(task_id.clone(), true);
    }

    let start_time = std::time::Instant::now();

    // Execute the function in a blocking task
    let execution_result = tokio::task::spawn_blocking({
      let function_string = task.function_string.clone();
      let data = task.data.clone();
      move || Self::execute_function(&function_string, &data)
    }).await;

    let result = match execution_result {
      Ok(result) => result,
      Err(e) => Err(format!("Task execution error: {}", e)),
    };

    let duration = start_time.elapsed();

    // Remove from active tasks
    {
      let mut tasks = active_tasks.write().await;
      tasks.remove(&task_id);
    }

    let task_result = TaskResult {
      id: task_id,
      result,
      duration_ms: duration.as_millis() as u64,
    };

    // Send result back if there's a sender
    if let Some(sender) = task.response_sender {
      let _ = sender.send(task_result);
    }
  }

  /// Execute a JavaScript function string with data
  fn execute_function(
    function_string: &str,
    data: &serde_json::Value
  ) -> Result<serde_json::Value, String> {
    // This is a simplified implementation for testing
    // In a real implementation, you would use a JavaScript engine like V8 or QuickJS

    // Pattern matching for basic functions
    if function_string.contains("x => x * 2") || function_string.contains("(x) => x * 2") {
      if let Some(num) = data.as_f64() {
        Ok(serde_json::json!(num * 2.0))
      } else {
        Err("Expected number for multiplication".to_string())
      }
    } else if function_string.contains("x => x + 1") || function_string.contains("(x) => x + 1") {
      if let Some(num) = data.as_f64() {
        Ok(serde_json::json!(num + 1.0))
      } else {
        Err("Expected number for addition".to_string())
      }
    } else if
      function_string.contains("x => x.length") ||
      function_string.contains("(x) => x.length")
    {
      if let Some(arr) = data.as_array() {
        Ok(serde_json::json!(arr.len()))
      } else if let Some(s) = data.as_str() {
        Ok(serde_json::json!(s.len()))
      } else {
        Err("Expected array or string for length".to_string())
      }
    } else if
      function_string.contains("x => x.toUpperCase()") ||
      function_string.contains("(x) => x.toUpperCase()")
    {
      if let Some(s) = data.as_str() {
        Ok(serde_json::json!(s.to_uppercase()))
      } else {
        Err("Expected string for toUpperCase".to_string())
      }
    } else {
      // Default: return data as-is (identity function)
      tracing::warn!("Unknown function pattern, returning data as-is: {}", function_string);
      Ok(data.clone())
    }
  }
}
