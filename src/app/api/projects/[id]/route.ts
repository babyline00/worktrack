import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const project = await db.project.update({
    where: { id: params.id },
    data: {
      name: body.name,
      client: body.client,
      description: body.description,
      status: (body.status ?? "ACTIVE").toUpperCase(),
      location: body.location,
      lat: body.lat ? parseFloat(body.lat) : undefined,
      lng: body.lng ? parseFloat(body.lng) : undefined,
      radiusM: body.radiusM ? parseInt(body.radiusM) : undefined,
    },
  });
  return NextResponse.json({ project });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await db.project.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
