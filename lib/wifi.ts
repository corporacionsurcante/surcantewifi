// ──────────────────────────────────────────────────────────────
// Datos de la red WiFi del ómnibus, usados para generar el QR que
// se imprime y se pega en cada ventanilla. Al escanearlo, el
// celular se conecta solo a la red (no hace falta que el pasajero
// busque el SSID a mano), y eso dispara el portal cautivo de
// Omada, que redirige a esta landing para elegir plan y pagar.
// ──────────────────────────────────────────────────────────────

// Se puede sobreescribir sin tocar código con la variable de
// entorno NEXT_PUBLIC_WIFI_SSID (por ejemplo si cambia el nombre
// de la red en el futuro).
export const WIFI_SSID =
  process.env.NEXT_PUBLIC_WIFI_SSID || "WAIFAI - CONECTANDO CAMPEONES";

// El estándar de QR para WiFi (usado por iOS y Android) requiere
// escapar barra invertida, punto y coma, coma y dos puntos dentro
// de cada valor.
function escaparValorWifi(valor: string): string {
  return valor.replace(/([\\;,:])/g, "\\$1");
}

/**
 * Arma la cadena `WIFI:...` que hay que codificar en el QR para que
 * el celular se conecte automáticamente a una red abierta (sin
 * contraseña) al escanearlo.
 */
export function generarCadenaWifiQr(ssid: string = WIFI_SSID): string {
  return `WIFI:T:nopass;S:${escaparValorWifi(ssid)};;`;
}
