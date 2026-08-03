"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function PaginaPagar() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center bg-[#0A0A0C]">
        <div className="w-8 h-8 rounded-full bg-[#6E3FA3] animate-pulse" />
      </main>
    }>
      <ContenidoPagar />
    </Suspense>
  );
}

function ContenidoPagar() {
  const parametros = useSearchParams();
  const urlPago = parametros.get("url") ?? "";
  const planNombre = decodeURIComponent(parametros.get("plan") ?? "WiFi Surcante");
  const precio = parametros.get("precio") ?? "";
  const [copiado, setCopiado] = useState(false);
  const [esCNA, setEsCNA] = useState(false);
  const [esAndroid, setEsAndroid] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const esIOS = /iphone|ipad|ipod/i.test(ua);
    const esAnd = /android/i.test(ua);
    setEsAndroid(esAnd);

    // Detectar iOS CNA: tiene AppleWebKit + Mobile pero NO tiene "Safari" al final
    // Fuente: https://stackoverflow.com/questions/19981008
    const iosCNA = esIOS && /applewebkit/i.test(ua) && /mobile/i.test(ua) && !ua.includes("Safari");
    // Android CPMB: tiene Android pero no tiene "Chrome" (mini-browser)
    const androidCPMB = esAnd && !/chrome/i.test(ua);
    setEsCNA(iosCNA || androidCPMB);
  }, []);

  async function copiarEnlace() {
    try {
      await navigator.clipboard.writeText(urlPago);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    } catch {
      // Fallback para navegadores sin clipboard API (iOS CNA incluido)
      try {
        const input = document.createElement("input");
        input.value = urlPago;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 3000);
      } catch {
        prompt("Copiá este enlace manualmente:", urlPago);
      }
    }
  }

  function abrirWhatsApp() {
    const precio_ = precio ? `$${Number(precio).toLocaleString("es-AR")}` : "";
    const msg = `ðŸ›œ Mi enlace de pago Surcante WiFi\n${planNombre}${precio_ ? ` - ${precio_}` : ""}\n\n${urlPago}`;
    window.location.href = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  }

  if (!urlPago) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0A0A0C] px-5">
        <p className="text-[#A0A0A8] text-sm text-center">
          Enlace de pago no disponible. Volvé e intentá de nuevo.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-5 py-10 bg-[#0A0A0C]">
      <div className="w-full max-w-sm">

        {/* Encabezado */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-[#6E3FA3] flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl">S</span>
          </div>
          <p className="text-white text-lg font-medium">{planNombre}</p>
          {precio && (
            <p className="text-[#8B5FBF] text-2xl font-semibold mt-1">
              ${Number(precio).toLocaleString("es-AR")}
            </p>
          )}
        </div>

        {esCNA ? (
          /* â”€â”€ Modo CNA: el mini-browser NO puede abrir la app de MP â”€â”€ */
          <>
            <div className="bg-[#1A1400] border border-[#4A3800] rounded-2xl p-4 mb-5">
              <p className="text-[#FFB800] text-sm font-medium mb-1">
                âš ï¸ Este navegador tiene limitaciones
              </p>
              <p className="text-[#C8A000] text-xs leading-relaxed">
                El navegador del portal WiFi no puede abrir la app de Mercado Pago directamente. Usá una de las opciones de abajo para pagar sin tener que loguearte.
              </p>
            </div>

            {/* Opción 1: WhatsApp (la más confiable) */}
            <div className="bg-[#0d1f14] border border-[#25D366] rounded-2xl p-4 mb-4">
              <p className="text-[#25D366] text-sm font-medium mb-1">
                âœ… Opción recomendada: WhatsApp
              </p>
              <p className="text-[#A0A0A8] text-xs mb-3 leading-relaxed">
                Te enviamos el enlace por WhatsApp. Desde la app, tocás el link y se abre directamente en Mercado Pago (donde ya estás logueado).
              </p>
              <button
                onClick={abrirWhatsApp}
                className="w-full py-3 rounded-xl text-[15px] font-medium bg-[#25D366] text-white hover:bg-[#1da851] transition"
              >
                ðŸ“² Recibir enlace por WhatsApp
              </button>
            </div>

            {/* Opción 2: Copiar enlace */}
            <div className="bg-[#18181B] border border-[#2A2A2E] rounded-2xl p-4 mb-4">
              <p className="text-white text-sm font-medium mb-1">Opción 2: Copiar enlace</p>
              <p className="text-[#A0A0A8] text-xs mb-3 leading-relaxed">
                Copiá el enlace, cerrá esta ventana (tocá <strong className="text-white">Cancelar</strong> o <strong className="text-white">Listo</strong>), abrí Safari o Chrome y pegá el enlace en la barra de direcciones.
              </p>
              <button
                onClick={copiarEnlace}
                className="w-full py-3 rounded-xl text-[14px] font-medium bg-[#2A2A2E] text-white hover:bg-[#3A3A3E] transition"
              >
                {copiado ? "âœ“ ¡Enlace copiado!" : "ðŸ“‹ Copiar enlace de pago"}
              </button>
              {copiado && (
                <p className="text-[#25D366] text-xs text-center mt-2">
                  Ahora cerrá esta ventana y pegalo en Safari o Chrome
                </p>
              )}
            </div>

            {/* Opción 3 Android: intent link (requiere tap del usuario) */}
            {esAndroid && (
              <div className="bg-[#18181B] border border-[#2A2A2E] rounded-2xl p-4 mb-4">
                <p className="text-white text-sm font-medium mb-1">Opción 3: Abrir en Mercado Pago</p>
                <p className="text-[#A0A0A8] text-xs mb-3">
                  Intentá abrir la app directamente. El sistema te preguntará si querés continuar.
                </p>
                <a
                  href={buildAndroidIntent(urlPago)}
                  className="block w-full py-3 rounded-xl text-[14px] font-medium bg-[#009EE3] text-white text-center"
                >
                  Abrir en app de Mercado Pago
                </a>
              </div>
            )}

            {/* Fallback web */}
            <a
              href={urlPago}
              className="block w-full py-3 rounded-xl text-[13px] font-medium text-[#5A5A60] border border-[#2A2A2E] text-center hover:bg-[#18181B] transition"
            >
              Pagar en este navegador (requiere cuenta) â†’
            </a>
          </>
        ) : (
          /* â”€â”€ Modo navegador normal: mostrar opciones y redirigir â”€â”€ */
          <>
            <div className="bg-[#18181B] border border-[#2A2A2E] rounded-2xl p-4 mb-4 text-center">
              <p className="text-[#A0A0A8] text-sm mb-3">Tu pago está listo</p>
              <a
                href={urlPago}
                className="block w-full py-3.5 rounded-xl text-[15px] font-medium bg-[#009EE3] text-white hover:bg-[#007bbd] transition mb-3"
              >
                Abrir Mercado Pago â†’
              </a>
              <button
                onClick={copiarEnlace}
                className="w-full py-3 rounded-xl text-[14px] font-medium bg-[#2A2A2E] text-white hover:bg-[#3A3A3E] transition"
              >
                {copiado ? "âœ“ Copiado" : "ðŸ“‹ Copiar enlace"}
              </button>
            </div>

            <button
              onClick={abrirWhatsApp}
              className="w-full py-3 rounded-xl text-[14px] font-medium bg-[#18181B] border border-[#25D366] text-[#25D366] hover:bg-[#0d1f14] transition"
            >
              ðŸ“² Compartir por WhatsApp
            </button>
          </>
        )}

        <p className="text-[11px] text-[#3A3A40] text-center mt-6">
          Al continuar aceptás los términos de servicio · Surcante
        </p>

      </div>
    </main>
  );
}

function buildAndroidIntent(url: string): string {
  const sinEsquema = url.replace(/^https?:\/\//, "");
  return `intent://${sinEsquema}#Intent;scheme=https;package=com.mercadopago.wallet;S.browser_fallback_url=${encodeURIComponent(url)};end`;
}

