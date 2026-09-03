/**
 * Minimal streaming adapter utilities (SSE parsing helpers)
 * Lightweight helper to aggregate chunks and call onToken for every text chunk.
 */
export function defaultStreamParser(stream: ReadableStream<Uint8Array>, onToken: (token: string) => void) {
  const reader = (stream as any).getReader();
  const decoder = new TextDecoder();

  function read() {
    return reader.read().then((res: any) => {
      if (res.done) return;
      const chunk = decoder.decode(res.value, { stream: true });
      // naive split by newlines or delimiters; provider-specific adapters can refine
      onToken(chunk);
      return read();
    });
  }

  return read();
}
