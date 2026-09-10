// ──────────────────────────────────────────────────────────────
// Vista imprimible con el QR dinámico de Mercado Pago de cada
// ventanilla. Cada QR queda pegado fijo en su ventanilla: el
// dibujo nunca cambia, pero el importe a cobrar se actualiza en
// el momento en que un pasajero elige un plan (ver
// /api/crear-pago-qr), así que conviene recortar por la línea
// punteada y pegar uno por ventanilla, sin repetir ninguno.
// ──────────────────────────────────────────────────────────────

"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

type VentanillaData = {
  numero: number;
  qrImageUrl: string;
};

function ContenidoImprimir() {
  const clave = useSearchParams().get("clave") ?? "";
  const [ventanillas, setVentanillas] = useState<VentanillaData[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!clave) { setError("Falta la clave de administrador"); return; }
    fetch("/api/admin-ventanillas", { headers: { "x-admin-key": clave } })
      .then((r) => {
        if (!r.ok) throw new Error("Clave incorrecta");
        return r.json();
      })
      .then((d) => setVentanillas(d.ventanillas ?? []))
      .catch(() => setError("No se pudieron cargar las ventanillas"));
  }, [clave]);

  if (error) {
    return <p className="text-center text-red-600 py-10">{error}</p>;
  }

  return (
    <main className="min-h-screen bg-white text-[#0A0A0C] px-6 py-10 print:py-0">
      <button
        onClick={() => window.print()}
        className="print:hidden mb-8 px-6 py-3 rounded-xl bg-[#6E3FA3] text-white text-sm font-medium"
      >
        Imprimir todas
      </button>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 print:grid-cols-1">
        {ventanillas.map((v) => (
          <div
            key={v.numero}
            className="border-4 border-dashed border-[#6E3FA3] rounded-3xl p-8 text-center break-inside-avoid print:break-after-page"
          >
            <p className="text-2xl font-bold mb-1">💳 Pagá tu WiFi acá</p>
            <p className="text-sm text-[#5A5A60] mb-6">Ventanilla {v.numero}</p>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={v.qrImageUrl}
              alt={`Código QR de pago de la ventanilla ${v.numero}`}
              className="mx-auto mb-6 w-64 h-64"
            />

            <ol className="text-left text-sm space-y-2 list-decimal list-inside">
              <li>Conectate primero a la red WiFi del ómnibus.</li>
              <li>Abrí la app de Mercado Pago y escaneá este QR.</li>
              <li>Elegí tu plan y confirmá el pago.</li>
              <li>Quedás conectado apenas se acredita el pago.</li>
            </ol>
          </div>
        ))}
      </div>

      {ventanillas.length === 0 && !error && (
        <p className="text-center text-[#5A5A60] py-10">Cargando...</p>
      )}
    </main>
  );
}

export default function PaginaVentanillasImprimir() {
  return (
    <Suspense fallback={<p className="text-center py-10">Cargando...</p>}>
      <ContenidoImprimir />
    </Suspense>
  );
}
