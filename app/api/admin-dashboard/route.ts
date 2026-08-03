import { NextRequest, NextResponse } from "next/server";
import { listarTodosLosPagos } from "@/lib/pagos";
import { listarTodosLosCodigos } from "@/lib/codigos";
import { obtenerPlanesDesdeRedis } from "@/lib/planes";

function verificarAdmin(solicitud: NextRequest): boolean {
  const clave = solicitud.headers.get("x-admin-key");
  return clave === process.env.CLAVE_ADMIN;
}

export async function GET(solicitud: NextRequest) {
  if (!verificarAdmin(solicitud)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const [pagos, codigos, planes] = await Promise.all([
    listarTodosLosPagos(),
    listarTodosLosCodigos(),
    obtenerPlanesDesdeRedis(),
  ]);

  const pagosConfirmados = pagos.filter((p) => p.confirmadoEn !== null);

  const recaudacionTotal = pagosConfirmados.reduce(
    (acc, p) => acc + (p.monto ?? planes.find((pl) => pl.id === p.planId)?.precio ?? 0),
    0
  );

  const porPlan = planes.map((plan) => {
    const pagosDelPlan = pagosConfirmados.filter((p) => p.planId === plan.id);
    return {
      plan: plan.nombre,
      cantidad: pagosDelPlan.length,
      total: pagosDelPlan.length * plan.precio,
    };
  });

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const pagosHoy = pagosConfirmados.filter(
    (p) => p.confirmadoEn && p.confirmadoEn >= hoy.getTime()
  );
  const recaudacionHoy = pagosHoy.reduce(
    (acc, p) => acc + (p.monto ?? planes.find((pl) => pl.id === p.planId)?.precio ?? 0),
    0
  );

  return NextResponse.json({
    resumen: {
      totalPagos: pagosConfirmados.length,
      recaudacionTotal,
      recaudacionHoy,
      pagosHoy: pagosHoy.length,
      porPlan,
    },
    pagos: pagosConfirmados.map((p) => ({
      id: p.preferenciaId,
      mac: p.clientMac,
      plan: planes.find((pl) => pl.id === p.planId)?.nombre ?? p.planId,
      monto: p.monto ?? planes.find((pl) => pl.id === p.planId)?.precio ?? 0,
      procesador: p.procesador ?? "mp",
      fechaPago: p.confirmadoEn,
      duracionMinutos: p.duracionMinutos,
    })),
    codigos: codigos.map((c) => ({
      codigo: c.codigo,
      estado: c.usadoEn ? "usado" : "disponible",
      creadoPor: c.creadoPor,
      creadoEn: c.creadoEn,
      usadoEn: c.usadoEn,
      mac: c.clientMac,
    })),
  });
}
