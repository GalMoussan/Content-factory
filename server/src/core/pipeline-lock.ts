import fs from 'node:fs';

interface LockFileContent {
  readonly pid: number;
  readonly runId: string;
  readonly startedAt: string;
}

/**
 * Check if a process with the given PID is alive.
 */
function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Acquire a pipeline lock. Returns true if lock was acquired.
 */
export function acquireLock(runId: string, lockFile: string): boolean {
  // Check for existing lock
  if (isLocked(lockFile)) {
    return false;
  }

  // Remove stale lock if it exists
  if (fs.existsSync(lockFile)) {
    fs.unlinkSync(lockFile);
  }

  // Write new lock file
  const content: LockFileContent = {
    pid: process.pid,
    runId,
    startedAt: new Date().toISOString(),
  };

  fs.writeFileSync(lockFile, JSON.stringify(content), 'utf8');
  return true;
}

/**
 * Release the pipeline lock.
 */
export function releaseLock(lockFile: string): void {
  if (fs.existsSync(lockFile)) {
    fs.unlinkSync(lockFile);
  }
}

/**
 * Check if a lock is currently held (lock file exists with alive PID).
 */
export function isLocked(lockFile: string): boolean {
  if (!fs.existsSync(lockFile)) {
    return false;
  }

  try {
    const content: LockFileContent = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
    return isPidAlive(content.pid);
  } catch {
    // Corrupted lock file — treat as stale
    return false;
  }
}
