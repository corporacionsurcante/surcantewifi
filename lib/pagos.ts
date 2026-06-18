// ──────────────────────────────────────────────────────────────
// ALMACENAMIENTO TEMPORAL: igual que en lib/codigos.ts, estos
// pagos viven en la memoria del servidor mientras está corriendo.
// Es suficiente para probar el flujo completo, pero antes de
// confiar en esto en producción real conviene moverlo a una base
// de datos persistente (Vercel KV o Postgres), porque la memoria
// se reinicia cada vez que el servidor se actualiza.
// ──────────────────────────────────────────────────────────────

export type PagoPendiente = {
  preferenciaId: string;
  planId: string;
  duracionMinutos: number;
  clientMac: string;
  apMac: string;
  ssidName: string;
  site: string;
  redirectUrl: string;
  creadoEn: number;
  confirmadoEn: number | null;
};

const pagos: Map<string, PagoPendiente> = new Map();

export function guardarPagoPendiente(pago: PagoPendiente) {
  pagos.set(pago.preferenciaId, pago);
}

export function buscarPago(preferenciaId: string): PagoPendiente | undefined {
  return pagos.get(preferenciaId);
}

export function marcarPagoConfirmado(preferenciaId: string) {
  const pago = pagos.get(preferenciaId);
  if (pago) {
    pago.confirmadoEn = Date.now();
  }
}
