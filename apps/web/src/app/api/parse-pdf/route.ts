import { NextResponse } from "next/server";
import pdfParse from "pdf-parse";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No PDF file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const pdfData = await pdfParse(buffer);

    return NextResponse.json({
      text: pdfData.text || "",
      numpages: pdfData.numpages || 1,
      info: pdfData.info
    });
  } catch (error: any) {
    console.error("[PDF Parse Error]:", error);
    return NextResponse.json(
      { error: error.message || "Failed to parse PDF document" },
      { status: 500 }
    );
  }
}
