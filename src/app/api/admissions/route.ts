import { NextRequest, NextResponse } from "next/server";
import { loadAdmissionRows } from "@/lib/repository";
import { parseCsvParam, parseMethod, parseMinHosp } from "@/lib/query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const products = parseCsvParam(params.get("products"), 5);
    const durations = parseCsvParam(params.get("durations"), 20);
    const method = parseMethod(params.get("method"));
    const minHosp = parseMinHosp(params.get("minHosp"));

    const rows = await loadAdmissionRows({ products, durations, method, minHosp });
    return NextResponse.json({ rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Nie udało się policzyć danych trybu przyjęcia." }, { status: 500 });
  }
}
