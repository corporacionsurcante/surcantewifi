import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { buscarPago, marcarPagoConfirmado } from "@/lib/pagos";
import { autorizarClienteEnOmada } from "@/lib/omada";

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

    // Llamamos a la API de Omada para autorizar el acceso real.
    //
    // IMPORTANTE: por ahora esto AUTORIZA por la duración del plan
    // comprado, pero todavía no SUMA tiempo si el pasajero ya tenía
    // un pack activo de antes (eso requeriría que Omada nos diga
    // cuánto tiempo le queda a esa MAC, y la documentación de este
    // endpoint no expone esa consulta directamente). Por ahora, si
    // alguien compra un pack adicional antes de que se le acabe el
    // anterior, el nuevo "time" reemplaza al anterior en vez de
    // sumarse. Es un caso de borde a resolver más adelante.
    const resultadoOmada = await autorizarClienteEnOmada({
      clientMac: pagoGuardado.clientMac,
      apMac: pagoGuardado.apMac,
      ssidName: pagoGuardado.ssidName,
      site: pagoGuardado.site,
      minutos: pagoGuardado.duracionMinutos,
    });

    if (!resultadoOmada.exito) {
      // El pago ya está confirmado y guardado (no se pierde), pero
      // la autorización en el router falló. Lo dejamos registrado
      // para poder revisarlo manualmente; no tiene sentido devolver
      // un error a Mercado Pago, porque el problema no es del pago.
      console.error(
        "[webhook-pago] El pago se confirmó pero Omada no autorizó el acceso:",
        resultadoOmada.motivo,
        "MAC:",
        pagoGuardado.clientMac
      );
    }

    console.log(
      "[webhook-pago] Pago confirmado. MAC:",
      pagoGuardado.clientMac,
      "Minutos autorizados:",
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
