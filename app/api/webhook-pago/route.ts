import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { buscarPago, marcarPagoConfirmado } from "@/lib/pagos";

const cliente = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
});

export async function POST(solicitud: NextRequest) {
  const notificacion = await solicitud.json();
  console.log("[webhook-pago] Notificación recibida:", notificacion);

  // Mercado Pago envía distintos tipos de eventos (pagos, tarjetas,
  // etc). Solo nos interesan los de tipo "payment".
  const tipoEvento = notificacion.type ?? notificacion.topic;
  const idPago = notificacion.data?.id ?? notificacion.resource;

  if (tipoEvento !== "payment" || !idPago) {
    // Respondemos 200 igual para que Mercado Pago no siga
    // reintentando notificaciones que no necesitamos procesar.
    return NextResponse.json({ recibido: true });
  }

  try {
    const pagoApi = new Payment(cliente);
    const detalle = await pagoApi.get({ id: idPago });

    if (detalle.status !== "approved") {
      // El pago existe pero todavía no está aprobado (puede estar
      // pendiente, rechazado, etc). No hacemos nada todavía; si
      // más tarde se aprueba, Mercado Pago va a volver a notificar.
      console.log(
        "[webhook-pago] Pago",
        idPago,
        "con estado:",
        detalle.status
      );
      return NextResponse.json({ recibido: true });
    }

    const referenciaExterna = detalle.external_reference;
    if (!referenciaExterna) {
      console.error("[webhook-pago] Pago aprobado sin external_reference");
      return NextResponse.json({ recibido: true });
    }

    const pagoGuardado = buscarPago(referenciaExterna);
    if (!pagoGuardado) {
      console.error(
        "[webhook-pago] No encontramos el pago pendiente para:",
        referenciaExterna
      );
      return NextResponse.json({ recibido: true });
    }

    if (pagoGuardado.confirmadoEn) {
      // Ya procesamos este pago antes (Mercado Pago puede mandar
      // la misma notificación más de una vez). No hacemos nada de
      // nuevo para no sumar minutos dos veces.
      return NextResponse.json({ recibido: true });
    }

    marcarPagoConfirmado(referenciaExterna);

    // ──────────────────────────────────────────────────────────
    // ACA VA OMADA: este es el punto donde hay que llamar a la
    // API del controlador Omada para autorizar a pagoGuardado.clientMac
    // por pagoGuardado.duracionMinutos exactos.
    //
    // Si el pasajero ya tenía tiempo activo de un pack anterior,
    // hay que SUMAR estos minutos al tiempo que le quedaba, no
    // reemplazarlo, para no perder el tiempo ya pagado.
    //
    // Datos disponibles para esa llamada:
    //   pagoGuardado.clientMac
    //   pagoGuardado.apMac
    //   pagoGuardado.duracionMinutos
    // ──────────────────────────────────────────────────────────

    console.log(
      "[webhook-pago] Pago confirmado. MAC:",
      pagoGuardado.clientMac,
      "Minutos a autorizar:",
      pagoGuardado.duracionMinutos
    );

    return NextResponse.json({ recibido: true });
  } catch (error) {
    console.error("[webhook-pago] Error al procesar la notificación:", error);
    // Igual respondemos 200: si devolvemos un error, Mercado Pago
    // reintenta muchas veces seguidas, lo cual puede generar ruido
    // si el error es algo que no se va a resolver solo.
    return NextResponse.json({ recibido: true });
  }
}
