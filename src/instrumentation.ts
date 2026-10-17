// Runs once when the server starts.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.BACKUP_DIR) {
    const { startBackups } = await import('./server/backup');
    startBackups(process.env.BACKUP_DIR);
  }
}
