import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireCompanyRole, CONFIG_WRITE_ROLES } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as any).companyId;
  const settings = await db.setting.findMany({ where: { companyId } });
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;
  return NextResponse.json({ settings: map });
}

export async function PATCH(req: Request) {
  // Role-checked: company settings gate geofencing, GPS accuracy and leave policy for everyone.
  const auth = await requireCompanyRole(CONFIG_WRITE_ROLES);
  if ("error" in auth) return auth.error;
  const { companyId } = auth;
  const body = await req.json(); // { key: value, ... }

  const ops = Object.entries(body).map(([key, value]) =>
    db.setting.upsert({
      where: { companyId_key: { companyId, key } },
      update: { value: String(value) },
      create: { companyId, key, value: String(value) },
    })
  );
  await Promise.all(ops);
  return NextResponse.json({ success: true });
}
