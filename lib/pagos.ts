import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

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
  // Para el panel admin
  monto?: number;
  procesador?: "mp" | "nave";
};

const PREFIJO_PAGO = "pago:";
const PREFIJO_MAC = "mac:";
const SET_PAGOS = "pagos:todos";

export async function guardarPagoPendiente(pago: PagoPendiente): Promise<void> {
  const key = `${PREFIJO_PAGO}${pago.preferenciaId}`;
  await redis.set(key, JSON.stringify(pago), { ex: 60 * 60 * 24 * 30 }); // 30 días
  await redis.sadd(SET_PAGOS, pago.preferenciaId);
}

export async function buscarPago(preferenciaId: string): Promise<PagoPendiente | null> {
  const key = `${PREFIJO_PAGO}${preferenciaId}`;
  const datos = await redis.get<string>(key);
  if (!datos) return null;
  return typeof datos === "string" ? JSON.parse(datos) : datos as PagoPendiente;
}

export async function marcarPagoConfirmado(preferenciaId: string): Promise<void> {
  const pago = await buscarPago(preferenciaId);
  if (!pago) return;
  pago.confirmadoEn = Date.now();
  const key = `${PREFIJO_PAGO}${preferenciaId}`;
  await redis.set(key, JSON.stringify(pago), { ex: 60 * 60 * 24 * 30 });
  // Guardamos también por MAC para saber qué dispositivos pagaron
  if (pago.clientMac) {
    const macKey = `${PREFIJO_MAC}${pago.clientMac}`;
    await redis.set(macKey, JSON.stringify(pago), { ex: 60 * 60 * 24 * 30 });
  }
}

export async function listarTodosLosPagos(): Promise<PagoPendiente[]> {
  const ids = await redis.smembers(SET_PAGOS);
  if (!ids || ids.length === 0) return [];
  const pagos: PagoPendiente[] = [];
  for (const id of ids) {
    const pago = await buscarPago(id as string);
    if (pago) pagos.push(pago);
  }
  return pagos.sort((a, b) => b.creadoEn - a.creadoEn);
}
