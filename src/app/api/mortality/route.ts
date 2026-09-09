import { NextRequest, NextResponse } from "next/server";
import { loadMortalityRows } from "@/lib/repository";
import { parseCsvParam, parseMethod, parseMinHosp, summarize, summarizeGeographies } from "@/lib/query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const products = parseCsvParam(params.get("products"), 5);
    const durations = parseCsvParam(params.get("durations"), 20);
    const method = parseMethod(params.get("method"));
    const minHosp = parseMinHosp(params.get("minHosp"));

    const [rows, baselineRows] = await Promise.all([
      loadMortalityRows({ products, durations, method, minHosp, baseline: false }),
      loadMortalityRows({ products, durations: [], method, minHosp: 0, baseline: true }),
    ]);

    return NextResponse.json({
      rows,
      current: summarize(rows),
      baseline: summarize(baselineRows),
      hasComparison: minHosp > 0 || durations.length > 0,
      areaStats: summarizeGeographies(rows),
      baselineAreaStats: summarizeGeographies(baselineRows),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Nie udało się policzyć danych dashboardu." }, { status: 500 });
  }
}
