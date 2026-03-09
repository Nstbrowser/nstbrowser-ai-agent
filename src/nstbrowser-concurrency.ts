/**
 * Concurrency control utilities for batch operations
 */

export interface ConcurrencyOptions {
  concurrency?: number;
  onProgress?: (completed: number, total: number, current?: string) => void;
  onError?: (error: Error, item: string) => void;
  stopOnError?: boolean;
}

export interface BatchResult<T> {
  results: T[];
  errors: Array<{ item: string; error: Error }>;
  succeeded: number;
  failed: number;
  total: number;
}

/**
 * Execute operations with concurrency control
 */
export async function batchExecute<T, R>(
  items: T[],
  operation: (item: T) => Promise<R>,
  options: ConcurrencyOptions = {}
): Promise<BatchResult<R>> {
  const {
    concurrency = 10,
    onProgress,
    onError,
    stopOnError = false,
  } = options;

  const results: R[] = [];
  const errors: Array<{ item: string; error: Error }> = [];
  let completed = 0;
  let running = 0;
  let index = 0;

  return new Promise((resolve, reject) => {
    const next = () => {
      // Check if all items are processed
      if (completed === items.length) {
        resolve({
          results,
          errors,
          succeeded: results.length,
          failed: errors.length,
          total: items.length,
        });
        return;
      }

      // Check if we should stop due to error
      if (stopOnError && errors.length > 0) {
        resolve({
          results,
          errors,
          succeeded: results.length,
          failed: errors.length,
          total: items.length,
        });
        return;
      }

      // Start new operations up to concurrency limit
      while (running < concurrency && index < items.length) {
        const currentIndex = index++;
        const item = items[currentIndex];
        running++;

        operation(item)
          .then((result) => {
            results.push(result);
            completed++;
            running--;

            if (onProgress) {
              onProgress(completed, items.length, String(item));
            }

            next();
          })
          .catch((error) => {
            const err = error instanceof Error ? error : new Error(String(error));
            errors.push({ item: String(item), error: err });
            completed++;
            running--;

            if (onError) {
              onError(err, String(item));
            }

            if (stopOnError) {
              resolve({
                results,
                errors,
                succeeded: results.length,
                failed: errors.length,
                total: items.length,
              });
            } else {
              next();
            }
          });
      }
    };

    next();
  });
}

/**
 * Progress bar for CLI output
 */
export class ProgressBar {
  private total: number;
  private completed: number = 0;
  private width: number = 40;
  private lastOutput: string = '';

  constructor(total: number, width: number = 40) {
    this.total = total;
    this.width = width;
  }

  update(completed: number, current?: string): void {
    this.completed = completed;
    this.render(current);
  }

  private render(current?: string): void {
    const percentage = Math.floor((this.completed / this.total) * 100);
    const filled = Math.floor((this.completed / this.total) * this.width);
    const empty = this.width - filled;

    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const output = `[${bar}] ${percentage}% (${this.completed}/${this.total})${current ? ` - ${current}` : ''}`;

    // Clear previous line and write new one
    if (this.lastOutput) {
      process.stderr.write('\r' + ' '.repeat(this.lastOutput.length) + '\r');
    }
    process.stderr.write(output);
    this.lastOutput = output;
  }

  finish(): void {
    process.stderr.write('\n');
  }
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    onRetry,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries - 1) {
        const delay = Math.min(initialDelay * Math.pow(backoffFactor, attempt), maxDelay);

        if (onRetry) {
          onRetry(attempt + 1, lastError);
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}
