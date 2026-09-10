"use client";

export default function BotonImprimir() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden mt-8 px-6 py-3 rounded-xl bg-[#6E3FA3] text-white text-sm font-medium hover:bg-[#5A3286] transition"
    >
      Imprimir cartel
    </button>
  );
}
