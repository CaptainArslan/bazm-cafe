type Handler = () => void;

let handler: Handler | null = null;

export function registerSessionExpiredHandler(next: Handler): void {
  handler = next;
}

export function emitSessionExpired(): void {
  handler?.();
}
