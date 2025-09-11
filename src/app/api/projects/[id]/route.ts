import { NextResponse } from "next/server";

// Minimal placeholder route to avoid build errors when Tailwind tracks changed files
// You can replace this with your real implementation later.
export async function GET(
  _request: Request,
  context: { params: { id: string } }
) {
  const { id } = context.params;
  return NextResponse.json({ ok: true, id, message: "Projects route placeholder" }, { status: 200 });
}

export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  const { id } = context.params;
  // Echo back any JSON for now
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    // ignore if no JSON
  }
  return NextResponse.json({ ok: true, id, received: body, message: "Projects route placeholder" }, { status: 200 });
}
