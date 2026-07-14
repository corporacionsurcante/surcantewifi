"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PLANES } from "@/lib/planes";

export default function PaginaPortal() {
  return (
    <Suspense fallback={null}>
      <ContenidoPortal />
    </Suspense>
  );
}

function ContenidoPortal() {
  const parametros = useSearchParams();
  const [planSeleccionado, setPlanSeleccionado] = useState(PLANES[1].id);
  const [cargando, setCargando] = useState<"mp" | "nave" | "whatsapp" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(true);
  const [accesoAutomatico, setAccesoAutomatico] = useState(false);

  const [mostrarCodigo, setMostrarCodigo] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [errorCodigo, setErrorCodigo] = useState<string | null>(null);
  const [canjeando, setCanjeando] = useState(false);

  const [macDePrueba, setMacDePrueba] = useState("");
  const [config, setConfig] = useState({ nave: true, mp: true, whatsapp: true });

  const macCliente = parametros.get("clientMac") || macDePrueba;
  const macAp = parametros.get("apMac") ?? "";
  const urlRedireccion = parametros.get("redirectUrl") ?? "";
  const nombreSsid = parametros.get("ssidName") ?? "";
  const nombreSitio = parametros.get("site") ?? "";

  useEffect(() => {
    const clave = "surcante-mac-prueba";
    let mac = window.localStorage.getItem(clave);
    if (!mac) {
      mac = "PRUEBA-" + Math.random().toString(36).slice(2, 10).toUpperCase();
      window.localStorage.setItem(clave, mac);
    }
    setMacDePrueba(mac);

    // Carga configuración de medios de pago
    fetch("/api/config-publica")
      .then((r) => r.json())
      .then((datos) => setConfig(datos))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const mac = parametros.get("clientMac") || macDePrueba;
    if (!mac || mac.startsWith("PRUEBA-")) {
      setVerificando(false);
      return;
    }

    // Verifica si esta MAC ya tiene acceso activo
    fetch("/api/verificar-acceso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientMac: mac,
        apMac: parametros.get("apMac") ?? "",
        ssidName: parametros.get("ssidName") ?? "",
        site: parametros.get("site") ?? "",
      }),
    })
      .then((r) => r.json())
      .then((datos) => {
        if (datos.tieneAcceso) {
          setAccesoAutomatico(true);
          // Redirigir a la URL original si existe
          const redirect = parametros.get("redirectUrl");
          if (redirect) {
            setTimeout(() => {
              window.location.href = redirect;
            }, 2000);
          }
        }
      })
      .catch(() => {})
      .finally(() => setVerificando(false));
  }, [macDePrueba, parametros]);

  // --- Helpers de plataforma y apertura ---
  function isAndroid() {
    return /android/i.test(navigator.userAgent);
  }
  function isiOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
  }

  // Esta función escribe una página intermedia en la ventana popup que:
  // - intenta abrir el esquema/intent de la app nativa,
  // - muestra un botón visible,
  // - hace fallback al url https si no se abre la app.
  function abrirUrlConEstrategias(url: string, popup: Window | null) {
    console.log("[abrirUrlConEstrategias] url:", url, "isAndroid:", isAndroid(), "isiOS:", isiOS(), "popup:", !!popup);

    const intermediateHtml = (appAttemptUrl: string, fallbackUrl: string) => `<!doctype html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>
        body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;display:flex;align-items:center;justify-content:center;height:100vh;background:#0A0A0C;color:#fff;margin:0}
        .box{max-width:420px;padding:20px;border-radius:12px;background:#111;box-shadow:0 6px 18px rgba(0,0,0,.6);text-align:center}
        a.btn{display:inline-block;margin-top:14px;padding:10px 16px;border-radius:8px;background:#6E3FA3;color:#fff;text-decoration:none}
        p.small{color:#A0A0A8;font-size:13px;margin-top:8px}
      </style>
    </head>
    <body>
      <div class="box">
        <div>
          <strong>Abrir en aplicación</strong>
          <p class="small">Estamos intentando abrir la aplicación nativa. Si no sucede automáticamente, tocá el botón abajo.</p>
          <a id="openBtn" class="btn" href="${fallbackUrl}" target="_blank" rel="noopener noreferrer">Abrir enlace de pago</a>
          <p class="small">Si el botón no funciona, volvé y probá desde otro navegador.</p>
        </div>
      </div>

      <script>
        (function(){
          var opened = false;
          var fallback = ${JSON.stringify(fallbackUrl)};
          var attempt = ${JSON.stringify(appAttemptUrl)};
          console.log("intermediate: attempt:", attempt);

          try {
            window.location.href = attempt;
            opened = true;
          } catch(e) {
            console.warn("assign attempt failed", e);
          }

          setTimeout(function(){
            try {
              if (location.href === attempt || !opened) {
                location.href = fallback;
              }
            } catch(e) {
              console.warn("fallback redirect failed", e);
              try { window.open(fallback, "_blank"); } catch(err) {}
            }
          }, 1100);

          var btn = document.getElementById("openBtn");
          if(btn) {
            btn.addEventListener("click", function(e){
              e.preventDefault();
              try { location.href = attempt; } catch(e) { location.href = fallback; }
            });
          }
        })();
      </script>
    </body>
    </html>`;

    // Construir attempt URL según plataforma
    let attemptUrl = url;
    if (isAndroid()) {
      const withoutScheme = url.replace(/^https?:\/\//, "");
      attemptUrl = `intent://${withoutScheme}#Intent;scheme=https;package=com.mercadolibre.android;S.browser_fallback_url=${encodeURIComponent(
        url
      )};end`;
    } else if (isiOS()) {
      attemptUrl = `mercadopago://payment?url=${encodeURIComponent(url)}`;
    } else {
      attemptUrl = url;
    }

    try {
      if (popup && !popup.closed) {
        popup.document.open();
        popup.document.write(intermediateHtml(attemptUrl, url));
        popup.document.close();
        return;
      }
    } catch (e) {
      console.warn("[abrirUrlConEstrategias] escribir en popup falló", e);
    }

    try {
      const html = intermediateHtml(attemptUrl, url);
      const blob = new Blob([html], { type: "text/html" });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      return;
    } catch (e) {
      console.warn("[abrirUrlConEstrategias] abrir blobUrl falló", e);
    }

    try {
      window.location.href = url;
    } catch (e) {
      console.error("[abrirUrlConEstrategias] no se pudo abrir la url por ningún medio", e);
    }
  }

  // --- Pago (abre una ventana en blanco sincrónica para preservar el gesto del usuario) ---
  async function pagar(medio: "mp" | "nave") {
    setError(null);
    setCargando(medio);

    let ventanaPopup: Window | null = null;
    try {
      ventanaPopup = window.open("", "_blank", "noopener,noreferrer");
    } catch (e) {
      console.log("[pagar] window.open falló", e);
      ventanaPopup = null;
    }

    try {
      const endpoint = medio === "nave" ? "/api/crear-pago-nave" : "/api/crear-pago";
      const respuesta = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: planSeleccionado,
          clientMac: macCliente,
          apMac: macAp,
          redirectUrl: urlRedireccion,
          ssidName: nombreSsid,
          site: nombreSitio,
        }),
      });
      if (!respuesta.ok) throw new Error("Error al iniciar el pago");
      const datos = await respuesta.json();

      const urlPago = datos.urlPago;
      if (!urlPago) throw new Error("No se recibió urlPago");
      abrirUrlConEstrategias(urlPago, ventanaPopup);
    } catch (e) {
      console.error("[pagar] error:", e);
      setError("Hubo un problema al iniciar el pago. Probá de nuevo.");
      setCargando(null);
    }
  }

  // --- Pago por WhatsApp (mismo enfoque para preservar gesto) ---
  async function pagarPorWhatsApp() {
    setError(null);
    setCargando("whatsapp");

    let ventanaPopup: Window | null = null;
    try {
      ventanaPopup = window.open("", "_blank", "noopener,noreferrer");
    } catch (e) {
      console.log("[pagarPorWhatsApp] window.open falló", e);
      ventanaPopup = null;
    }

    try {
      const respuesta = await fetch("/api/crear-pago", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: planSeleccionado,
          clientMac: macCliente,
          apMac: macAp,
          redirectUrl: urlRedireccion,
          ssidName: nombreSsid,
          site: nombreSitio,
        }),
      });
      if (!respuesta.ok) throw new Error("Error al iniciar el pago");
      const datos = await respuesta.json();
      const planActual = PLANES.find((p) => p.id === planSeleccionado) ?? PLANES[1];
      const mensaje = `🛜 Mi link de pago WAIFAI\n${planActual.nombre} - $${planActual.precio.toLocaleString("es-AR")}\n\n${datos.urlPago}`;
      const waUrl = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;

      abrirUrlConEstrategias(waUrl, ventanaPopup);
    } catch (e) {
      console.error("[pagarPorWhatsApp] error:", e);
      setError("Hubo un problema. Probá de nuevo.");
    } finally {
      setCargando(null);
    }
  }

  async function canjearCodigo() {
    setErrorCodigo(null);
    setCanjeando(true);
    try {
      const respuesta = await fetch("/api/canjear-codigo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo,
          clientMac: macCliente,
          apMac: macAp,
          ssidName: nombreSsid,
          site: nombreSitio,
        }),
      });
      const datos = await respuesta.json();
      if (datos.exito) {
        window.location.href = "/pagado?codigo=true";
      } else {
        setErrorCodigo(datos.motivo ?? "Código inválido");
      }
    } catch {
      setErrorCodigo("Hubo un problema. Probá de nuevo.");
    } finally {
      setCanjeando(false);
    }
  }

  const ocupado = cargando !== null;

  // Pantalla de verificando acceso
  if (verificando) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-[#0A0A0C]">
        <div className="w-8 h-8 rounded-full bg-[#6E3FA3] animate-pulse mx-auto mb-4" />
        <p className="text-[#A0A0A8] text-sm">Verificando acceso...</p>
      </main>
    );
  }

  // Pantalla de acceso automático reconocido
  if (accesoAutomatico) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-5 bg-[#0A0A0C]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-700 flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-3xl">✓</span>
          </div>
          <p className="text-white text-xl font-medium mb-2">¡Bienvenido de vuelta!</p>
          <p className="text-[#A0A0A8] text-sm">Tu acceso sigue activo. Conectando...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-5 py-9 bg-[#0A0A0C]">
      <div className="w-full max-w-sm">

        <div className="text-center mb-7">
          <div className="flex items-center justify-center gap-1.5 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8B5FBF] animate-pulse" />
            <span className="text-[11px] text-[#A0A0A8] tracking-wide">
              CONECTADO A WIFI SURCANTE
            </span>
          </div>
          <div className="w-16 h-16 rounded-full bg-[#6E3FA3] flex items-center justify-center mx-auto">
            <span className="text-white text-3xl font-medium">S</span>
          </div>
          <p className="text-white text-xl font-medium mt-4 mb-1">Surcante WiFi</p>
          <p className="text-[#A0A0A8] text-[13px]">Tu viaje, conectado</p>
        </div>

        <p className="text-xs font-medium text-[#8B5FBF] uppercase tracking-wide mb-3">
          Elegí tu plan
        </p>

        <div className="flex flex-col gap-2.5">
          {PLANES.map((plan) => (
            <button
              key={plan.id}
              onClick={() => setPlanSeleccionado(plan.id)}
              className={`flex items-center justify-between rounded-2xl px-4 py-3.5 text-left transition border ${
                planSeleccionado === plan.id
                  ? "bg-[#211A2B] border-[#8B5FBF]"
                  : "bg-[#18181B] border-[#2A2A2E]"
              }`}
            >
              <div>
                <p className="text-[14px] font-medium text-white">{plan.nombre}</p>
                <p className="text-[13px] text-[#A0A0A8] mt-0.5">{plan.descripcion}</p>
              </div>
              <p className="text-[18px] font-medium text-white whitespace-nowrap ml-3">
                ${plan.precio.toLocaleString("es-AR")}
              </p>
            </button>
          ))}
        </div>

        {error && (
          <p className="text-sm text-red-400 mt-4 text-center">{error}</p>
        )}

        <p className="text-xs text-[#A0A0A8] text-center mt-5 mb-3">Elegí cómo pagar</p>

        {config.nave && (
          <button
            onClick={() => pagar("nave")}
            disabled={ocupado}
            className="w-full py-3.5 rounded-xl text-[15px] font-medium bg-[#6E3FA3] hover:bg-[#5A3286] active:scale-[0.98] transition disabled:opacity-60 mb-2.5"
          >
            {cargando === "nave" ? "Abriendo pago..." : "Pagar con Nave / Galicia"}
          </button>
        )}

        {config.mp && (
          <button
            onClick={() => pagar("mp")}
            disabled={ocupado}
            className="w-full py-3.5 rounded-xl text-[15px] font-medium bg-[#18181B] border border-[#2A2A2E] hover:bg-[#211A2B] active:scale-[0.98] transition disabled:opacity-60 mb-2.5"
          >
            {cargando === "mp" ? "Abriendo pago..." : "Pagar con Mercado Pago"}
          </button>
        )}

        {config.whatsapp && (
          <button
            onClick={pagarPorWhatsApp}
            disabled={ocupado}
            className="w-full py-3.5 rounded-xl text-[15px] font-medium bg-[#18181B] border border-[#25D366] text-[#25D366] hover:bg-[#0d1f14] active:scale-[0.98] transition disabled:opacity-60"
          >
            {cargando === "whatsapp" ? "Generando link..." : "📲 Pagar por WhatsApp"}
          </button>
        )}

        <p className="text-[11px] text-[#5A5A60] text-center mt-4">
          Al continuar aceptás los términos de servicio · Surcante
        </p>

        {!mostrarCodigo ? (
          <button
            onClick={() => setMostrarCodigo(true)}
            className="block w-full text-center text-[12px] text-[#5A5A60] mt-6 underline"
          >
            ¿Tenés un código de acceso?
          </button>
        ) : (
          <div className="mt-6 pt-5 border-t border-[#2A2A2E]">
            <p className="text-[12px] text-[#A0A0A8] mb-2 text-center">
              Ingresá tu código de acceso
            </p>
            <input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX"
              className="w-full px-4 py-3 rounded-xl bg-[#18181B] border border-[#2A2A2E] text-white text-center font-mono tracking-wide mb-2"
            />
            {errorCodigo && (
              <p className="text-sm text-red-400 mb-2 text-center">{errorCodigo}</p>
            )}
            <button
              onClick={canjearCodigo}
              disabled={canjeando || !codigo}
              className="w-full py-3 rounded-xl text-[14px] font-medium bg-[#18181B] border border-[#2A2A2E] hover:bg-[#211A2B] transition disabled:opacity-60"
            >
              {canjeando ? "Validando..." : "Usar código"}
            </button>
          </div>
        )}

      </div>
    </main>
  );
}
