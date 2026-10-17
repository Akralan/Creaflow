import type { Metadata } from "next";
import { NO_INDEX } from "@/lib/seo";

// The login page is a client component: the title and the no-index directive are set here.
export const metadata: Metadata = { title: "Log in", robots: NO_INDEX };

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
