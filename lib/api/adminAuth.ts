import { NextRequest, NextResponse } from "next/server";

export function isAdminRequestAuthorized(req: NextRequest): boolean {
  const expectedSecret = process.env.ADMIN_API_SECRET;
  if (!expectedSecret) return false;
  const providedSecret = req.headers.get("x-admin-secret");
  return providedSecret != null && providedSecret === expectedSecret;
}

export function unauthorizedJson() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

