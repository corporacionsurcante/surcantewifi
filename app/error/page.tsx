"use client";

export default function PaginaError() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 py-9 text-center">
      <div className="w-full max-w-sm">
        <p className="text-white text-xl font-medium mb-2">
          Algo no funcionó
        </p>
        <p className="text-[#A0A0A8] text-[14px]">
          No pudimos procesar tu pago. Volvé a intentarlo o pedí ayuda al
          chofer.
        </p>
      </div>
    </main>
  );
}
