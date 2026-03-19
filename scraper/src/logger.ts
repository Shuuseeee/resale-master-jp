const pad = (n: number) => String(n).padStart(2, '0');

function timestamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function log(msg: string) {
  console.log(`[${timestamp()}] ${msg}`);
}

export function logError(msg: string, err?: unknown) {
  console.error(`[${timestamp()}] ERROR: ${msg}`, err instanceof Error ? err.message : err ?? '');
}
