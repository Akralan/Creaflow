import { handleOAuthStart } from "@/lib/oauth/handlers";

export async function GET(_request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  return handleOAuthStart(provider);
}
