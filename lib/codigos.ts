import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export type Codigo = {
  codigo: string;
  creadoEn: number;
  usadoEn: number | null;
  clientMac: string | null;
  creadoPor: string;
  duracionMinutos: number;
};

const PREFIJO_CODIGO = "codigo:";
const PREFIJO_MAC = "mac:";
const SET_CODIGOS = "codigos:todos";

// Duración por defecto de códigos: 1 año
const UN_ANIO_EN_MINUTOS = 60 * 24 * 365;

function generarCodigo(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const parte = () =>
    Array.from({ length: 4 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  return `${parte()}-${parte()}`;
}

export async function crearCodigo(creadoPor: string = "ADMIN"): Promise<Codigo> {
  const codigo: Codigo = {
    codigo: generarCodigo(),
    creadoEn: Date.now(),
    usadoEn: null,
    clientMac: null,
    creadoPor,
    duracionMinutos: UN_ANIO_EN_MINUTOS,
  };
  const key = `${PREFIJO_CODIGO}${codigo.codigo}`;
  await redis.set(key, JSON.stringify(codigo), { ex: 60 * 60 * 24 * 400 });
  await redis.sadd(SET_CODIGOS, codigo.codigo);
  return codigo;
}

export async function usarCodigo(
  codigoStr: string,
  clientMac: string
): Promise<{ exito: boolean; motivo?: string }> {
  const key = `${PREFIJO_CODIGO}${codigoStr.toUpperCase()}`;
  const datos = await redis.get<string>(key);
  if (!datos) return { exito: false, motivo: "Código inválido" };

  const codigo: Codigo =
    typeof datos === "string" ? JSON.parse(datos) : (datos as Codigo);

  if (codigo.usadoEn) {
    return { exito: false, motivo: "Este código ya fue utilizado" };
  }

  codigo.usadoEn = Date.now();
  codigo.clientMac = clientMac;
  await redis.set(key, JSON.stringify(codigo), { ex: 60 * 60 * 24 * 400 });

  // Guardamos por MAC para reconexión automática
  const macKey = `${PREFIJO_MAC}${clientMac}`;
  await redis.set(macKey, JSON.stringify({
    usadoEn: codigo.usadoEn,
    duracionMinutos: codigo.duracionMinutos,
    tipo: "codigo",
    codigo: codigoStr,
  }), { ex: 60 * 60 * 24 * 400 });

  return { exito: true };
}

export async function listarTodosLosCodigos(): Promise<Codigo[]> {
  const ids = await redis.smembers(SET_CODIGOS);
  if (!ids || ids.length === 0) return [];
  const codigos: Codigo[] = [];
  for (const id of ids) {
    const key = `${PREFIJO_CODIGO}${id}`;
    const datos = await redis.get<string>(key);
    if (datos) {
      codigos.push(
        typeof datos === "string" ? JSON.parse(datos) : (datos as Codigo)
      );
    }
  }
  return codigos.sort((a, b) => b.creadoEn - a.creadoEn);
}
