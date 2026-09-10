import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

// ──────────────────────────────────────────────────────────────
// Cada "ventanilla" representa un QR físico impreso y pegado en
// una ventana del ómnibus. En Mercado Pago cada uno es una "caja"
// (POS) distinta e independiente, para que dos pasajeros puedan
// pagar al mismo tiempo sin pisarse (ver lib/mercadopagoQr.ts).
// ──────────────────────────────────────────────────────────────

export type Ventanilla = {
  numero: number;
  externalId: string;
  posId: number;
  nombre: string;
  qrImageUrl: string;
  creadoEn: number;
};

const PREFIJO_VENTANILLA = "ventanilla:";
const SET_VENTANILLAS = "ventanillas:todas";

export async function guardarVentanilla(ventanilla: Ventanilla): Promise<void> {
  await redis.set(
    `${PREFIJO_VENTANILLA}${ventanilla.numero}`,
    JSON.stringify(ventanilla)
  );
  await redis.sadd(SET_VENTANILLAS, String(ventanilla.numero));
}

export async function buscarVentanilla(
  numero: number
): Promise<Ventanilla | null> {
  const datos = await redis.get<string>(`${PREFIJO_VENTANILLA}${numero}`);
  if (!datos) return null;
  return typeof datos === "string" ? JSON.parse(datos) : (datos as Ventanilla);
}

export async function listarVentanillas(): Promise<Ventanilla[]> {
  const ids = await redis.smembers(SET_VENTANILLAS);
  if (!ids || ids.length === 0) return [];
  const ventanillas: Ventanilla[] = [];
  for (const id of ids) {
    const ventanilla = await buscarVentanilla(Number(id));
    if (ventanilla) ventanillas.push(ventanilla);
  }
  return ventanillas.sort((a, b) => a.numero - b.numero);
}

export async function siguienteNumeroDisponible(): Promise<number> {
  const actuales = await listarVentanillas();
  if (actuales.length === 0) return 1;
  return Math.max(...actuales.map((v) => v.numero)) + 1;
}
