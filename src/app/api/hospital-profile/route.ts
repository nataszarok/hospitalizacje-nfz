import { NextRequest, NextResponse } from "next/server";
import { loadHospitalProfile } from "@/lib/repository";
import type { EstimationMethod } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const method: EstimationMethod = params.get("method") === "sim" ? "sim" : "min";
    const durations = (params.get("durations") ?? "").split(",").filter(Boolean);
    return NextResponse.json(await loadHospitalProfile({
      owNfz: params.get("owNfz") ?? "",
      nip: params.get("nip") ?? "",
      durations,
      method,
    }));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Nie udało się pobrać profilu szpitala." }, { status: 500 });
  }
}
