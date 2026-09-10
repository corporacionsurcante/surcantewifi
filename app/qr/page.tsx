// ──────────────────────────────────────────────────────────────
// Cartel imprimible con el QR de conexión al WiFi, pensado para
// pegar uno en cada ventanilla del ómnibus. Al escanearlo con la
// cámara, el celular ofrece unirse a la red directamente (no hace
// falta buscarla a mano en los ajustes). Una vez conectado, Omada
// redirige automáticamente a la landing de pago ("/"), donde el
// pasajero elige un plan y paga; al confirmarse el pago queda
// conectado a internet.
// ──────────────────────────────────────────────────────────────

import QRCode from "qrcode";
import { WIFI_SSID, generarCadenaWifiQr } from "@/lib/wifi";
import BotonImprimir from "./boton-imprimir";

export const dynamic = "force-static";

export default async function PaginaQr() {
  const qrDataUrl = await QRCode.toDataURL(generarCadenaWifiQr(), {
    width: 640,
    margin: 1,
    color: { dark: "#0A0A0C", light: "#FFFFFF" },
  });

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-10 bg-white text-[#0A0A0C] print:py-0">
      <div className="w-full max-w-sm text-center border-4 border-[#6E3FA3] rounded-3xl p-8 print:border-2">
        <p className="text-2xl font-bold mb-1">📶 WiFi a bordo</p>
        <p className="text-sm text-[#5A5A60] mb-6">
          Escaneá, conectate y navegá durante el viaje
        </p>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrDataUrl}
          alt="Código QR para conectarse al WiFi del ómnibus"
          className="mx-auto mb-6 w-64 h-64"
        />

        <ol className="text-left text-sm space-y-2 mb-4 list-decimal list-inside">
          <li>Escaneá este código con la cámara de tu celular.</li>
          <li>Confirmá la conexión a la red WiFi.</li>
          <li>Se va a abrir la página de pago sola.</li>
          <li>Elegí tu plan, pagá y quedás conectado.</li>
        </ol>

        <p className="text-xs text-[#5A5A60]">Red: {WIFI_SSID}</p>
      </div>

      <BotonImprimir />
    </main>
  );
}
