import { NextRequest } from "next/server";
import { handleOAuthCallback } from "@/lib/oauth/handlers";

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  return handleOAuthCallback(request, provider);
}
