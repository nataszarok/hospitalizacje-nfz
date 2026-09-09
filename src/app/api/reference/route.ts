import { NextResponse } from "next/server";
import { loadReferenceData } from "@/lib/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await loadReferenceData());
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Nie udało się pobrać danych referencyjnych." }, { status: 500 });
  }
}
