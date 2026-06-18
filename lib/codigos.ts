// ──────────────────────────────────────────────────────────────
// ALMACENAMIENTO TEMPORAL: estos códigos viven en la memoria del
// servidor mientras está corriendo. Esto es suficiente para probar
// el flujo completo, pero en producción real conviene moverlo a
// una base de datos (por ejemplo Vercel KV o Postgres), porque la
// memoria se reinicia cada vez que el servidor se actualiza o
// reinicia, y los códigos generados se perderían.
//
// Lo dejamos así por ahora para que puedas probar todo el flujo
// sin necesidad de configurar una base de datos todavía.
// ──────────────────────────────────────────────────────────────

export type CodigoAcceso = {
  codigo: string;
  creadoEn: number;
  usadoEn: number | null;
  macDispositivo: string | null;
  nota: string;
};

const codigos: Map<string, CodigoAcceso> = new Map();

export function generarCodigo(nota: string): CodigoAcceso {
  const codigo = crearCodigoLegible();
  const nuevo: CodigoAcceso = {
    codigo,
    creadoEn: Date.now(),
    usadoEn: null,
    macDispositivo: null,
    nota,
  };
  codigos.set(codigo, nuevo);
  return nuevo;
}

export function listarCodigos(): CodigoAcceso[] {
  return Array.from(codigos.values()).sort((a, b) => b.creadoEn - a.creadoEn);
}

// Intenta usar un código. Devuelve null si no existe.
// Si ya fue usado en OTRO dispositivo, devuelve el código con
// un indicador de rechazo. Si es la primera vez, o si el mismo
// dispositivo vuelve a conectarse, lo autoriza.
export function usarCodigo(
  codigo: string,
  macDispositivo: string
): { exito: boolean; motivo?: string } {
  const entrada = codigos.get(codigo.toUpperCase().trim());
  if (!entrada) {
    return { exito: false, motivo: "Código no encontrado" };
  }
  if (entrada.usadoEn && entrada.macDispositivo !== macDispositivo) {
    return { exito: false, motivo: "Este código ya fue usado en otro dispositivo" };
  }
  if (!entrada.usadoEn) {
    entrada.usadoEn = Date.now();
    entrada.macDispositivo = macDispositivo;
  }
  return { exito: true };
}

function crearCodigoLegible(): string {
  // Evita caracteres confusos como 0/O o 1/I para que sea fácil
  // de transcribir a mano o leer en voz alta.
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let resultado = "";
  for (let i = 0; i < 8; i++) {
    resultado += alfabeto[Math.floor(Math.random() * alfabeto.length)];
    if (i === 3) resultado += "-";
  }
  return resultado;
}
