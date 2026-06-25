import { NextRequest, NextResponse } from "next/server";
import { buscarPago, marcarPagoConfirmado } from "@/lib/pagos";
import { autorizarClienteEnOmada } from "@/lib/omada";

// ──────────────────────────────────────────────────────────────
// Webhook de Nave: recibe notificaciones cuando un pago cambia
// de estado. Nave envía el payment_id y una URL para consultar
// el estado actualizado del pago.
//
// Nave reintenta hasta 5 veces si no recibimos HTTP 200.
// ──────────────────────────────────────────────────────────────

const esSandbox = process.env.NAVE_SANDBOX === "true";

const NAVE_AUTH_URL = esSandbox
  ? "https://homoservices.apinaranja.com/security-ms/api/security/auth0/b2b/m2msPrivate"
  : "https://services.apinaranja.com/security-ms/api/security/auth0/b2b/m2msPrivate";

async function obtenerTokenNave(): Promise<string> {
  const respuesta = await fetch(NAVE_AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.NAVE_CLIENT_ID,
        client_secret: process.env.NAVE_CLIENT_SECRET,
        audience:
          process.env.NAVE_AUDIENCE ??
          "https://naranja.com/ranty/merchants/api",
      }),
    }
  );
  const datos = await respuesta.json();
  return datos.access_token;
}

export async function POST(solicitud: NextRequest) {
  const cuerpo = await solicitud.json();
  const { payment_id, payment_check_url, external_payment_id } = cuerpo;

  console.log("[webhook-nave] Notificación recibida:", {
    payment_id,
    external_payment_id,
  });

  // Respondemos 200 inmediatamente para que Nave no reintente.
  // El procesamiento real lo hacemos de forma asíncrona abajo.
  // (Next.js procesa el resto antes de cerrar la conexión)

  try {
    // Consultamos el estado real del pago en Nave.
    const token = await obtenerTokenNave();
    const respuesta = await fetch(payment_check_url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const pago = await respuesta.json();

    if (pago?.status?.name !== "APPROVED") {
      console.log(
        "[webhook-nave] Pago no aprobado:",
        pago?.status?.name,
        external_payment_id
      );
      return NextResponse.json({ recibido: true });
    }

    // Buscamos el pago pendiente guardado cuando se creó la intención.
    const pagoGuardado = buscarPago(external_payment_id);
    if (!pagoGuardado) {
      console.error(
        "[webhook-nave] No se encontró el pago pendiente:",
        external_payment_id
      );
      return NextResponse.json({ recibido: true });
    }

    if (pagoGuardado.confirmadoEn) {
      // Ya lo procesamos antes (idempotencia).
      return NextResponse.json({ recibido: true });
    }

    marcarPagoConfirmado(external_payment_id);

    const resultadoOmada = await autorizarClienteEnOmada({
      clientMac: pagoGuardado.clientMac,
      apMac: pagoGuardado.apMac,
      ssidName: pagoGuardado.ssidName,
      site: pagoGuardado.site,
      minutos: pagoGuardado.duracionMinutos,
    });

    if (!resultadoOmada.exito) {
      console.error(
        "[webhook-nave] Pago confirmado pero Omada no autorizó:",
        resultadoOmada.motivo,
        "MAC:",
        pagoGuardado.clientMac
      );
    } else {
      console.log(
        "[webhook-nave] ✓ Pago aprobado y acceso autorizado. MAC:",
        pagoGuardado.clientMac,
        "Minutos:",
        pagoGuardado.duracionMinutos
      );
    }
  } catch (error) {
    console.error("[webhook-nave] Error procesando pago:", error);
  }

  return NextResponse.json({ recibido: true });
}
