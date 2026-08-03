export function generarReferenciaExterna(): string {
  return `surcante-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}