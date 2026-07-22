import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { Plan, PLANES_PREDETERMINADOS } from "@/lib/planes";

const redis = Redis.fromEnv();
const KEY_PLANES = "planes:lista";

function verificarAdmin(solicitud: NextRequest): boolean {
  const clave = solicitud.headers.get("x-admin-key");
  return clave === process.env.CLAVE_ADMIN;
}

async function obtenerPlanesDelRedis(): Promise<Plan[]> {
  try {
    const datos = await redis.get<string>(KEY_PLANES);
    if (!datos) {
      await redis.set(KEY_PLANES, JSON.stringify(PLANES_PREDETERMINADOS));
      return PLANES_PREDETERMINADOS;
    }
    const planes = typeof datos === "string" ? JSON.parse(datos) : datos;
    return Array.isArray(planes) ? planes : PLANES_PREDETERMINADOS;
  } catch (e) {
    console.error("Error obteniendo planes:", e);
    return PLANES_PREDETERMINADOS;
  }
}

async function guardarPlanesEnRedis(planes: Plan[]): Promise<void> {
  await redis.set(KEY_PLANES, JSON.stringify(planes));
}

export async function GET() {
  const planes = await obtenerPlanesDelRedis();
  return NextResponse.json(planes);
}

export async function POST(solicitud: NextRequest) {
  if (!verificarAdmin(solicitud)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const cuerpo = await solicitud.json();
    const { nombre, descripcion, precio, duracionMinutos } = cuerpo;

    if (!nombre || typeof precio !== "number" || typeof duracionMinutos !== "number") {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 }
      );
    }

    const planes = await obtenerPlanesDelRedis();
    const nuevoId = `pack-${Date.now()}`;
    const nuevoPlan: Plan = {
      id: nuevoId,
      nombre,
      descripcion: descripcion || "",
      precio,
      duracionMinutos,
      activo: true,
      descuento: 0,
      creadoEn: Date.now(),
      actualizadoEn: Date.now(),
    };

    planes.push(nuevoPlan);
    await guardarPlanesEnRedis(planes);

    return NextResponse.json(nuevoPlan, { status: 201 });
  } catch (error) {
    console.error("Error creando plan:", error);
    return NextResponse.json(
      { error: "Error al crear el plan" },
      { status: 500 }
    );
  }
}

export async function PUT(solicitud: NextRequest) {
  if (!verificarAdmin(solicitud)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const cuerpo = await solicitud.json();
    const { id, nombre, descripcion, precio, duracionMinutos, activo, descuento } = cuerpo;

    if (!id) {
      return NextResponse.json(
        { error: "ID de plan requerido" },
        { status: 400 }
      );
    }

    const planes = await obtenerPlanesDelRedis();
    const indice = planes.findIndex((p) => p.id === id);

    if (indice === -1) {
      return NextResponse.json(
        { error: "Plan no encontrado" },
        { status: 404 }
      );
    }

    const planActualizado: Plan = {
      ...planes[indice],
      ...(nombre !== undefined && { nombre }),
      ...(descripcion !== undefined && { descripcion }),
      ...(typeof precio === "number" && { precio }),
      ...(typeof duracionMinutos === "number" && { duracionMinutos }),
      ...(typeof activo === "boolean" && { activo }),
      ...(typeof descuento === "number" && { descuento }),
      actualizadoEn: Date.now(),
    };

    planes[indice] = planActualizado;
    await guardarPlanesEnRedis(planes);

    return NextResponse.json(planActualizado);
  } catch (error) {
    console.error("Error actualizando plan:", error);
    return NextResponse.json(
      { error: "Error al actualizar el plan" },
      { status: 500 }
    );
  }
}

export async function DELETE(solicitud: NextRequest) {
  if (!verificarAdmin(solicitud)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(solicitud.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID de plan requerido" },
        { status: 400 }
      );
    }

    const planes = await obtenerPlanesDelRedis();
    const indice = planes.findIndex((p) => p.id === id);

    if (indice === -1) {
      return NextResponse.json(
        { error: "Plan no encontrado" },
        { status: 404 }
      );
    }

    planes.splice(indice, 1);
    await guardarPlanesEnRedis(planes);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error eliminando plan:", error);
    return NextResponse.json(
      { error: "Error al eliminar el plan" },
      { status: 500 }
    );
  }
}
