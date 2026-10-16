import { handleOAuthStart } from "@/lib/oauth/handlers";

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  return handleOAuthStart(provider, new URL(request.url).searchParams.get("returnTo"));
}
