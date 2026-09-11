import { NextRequest, NextResponse } from "next/server";
import { loadHospitalRanking } from "@/lib/repository";
import { parseCsvParam, parseMethod, parseMinHosp } from "@/lib/query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const products = parseCsvParam(params.get("products"), 100);
    const durations = parseCsvParam(params.get("durations"), 20);
    const method = parseMethod(params.get("method"));
    const minHosp = parseMinHosp(params.get("minHosp"));

    return NextResponse.json(await loadHospitalRanking({ products, durations, method, minHosp }));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Nie udało się policzyć rankingu szpitali." }, { status: 500 });
  }
}
