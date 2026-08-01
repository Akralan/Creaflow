"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/apiClient";
import { color } from "@/lib/design/tokens";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { user } = await api.me();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { profile } = await api.getProfile();
      router.replace(profile ? "/calendar" : "/onboarding");
    })();
  }, [router]);

  return <div style={{ height: "100vh", width: "100%", background: color.pageBg }} />;
}
