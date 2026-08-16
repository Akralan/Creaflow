"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/apiClient";
import { color } from "@/lib/design/tokens";
import LandingPage from "@/components/landing/LandingPage";

export default function RootPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    (async () => {
      const { user } = await api.me();
      if (!user) {
        setChecking(false);
        return;
      }
      setAuthenticated(true);
      const { profile } = await api.getProfile();
      router.replace(profile ? "/calendar" : "/onboarding");
    })();
  }, [router]);

  if (checking) {
    return <div style={{ height: "100vh", width: "100%", background: color.pageBg }} />;
  }

  if (authenticated) {
    // Redirection en cours vers /calendar ou /onboarding — évite un flash de landing page.
    return <div style={{ height: "100vh", width: "100%", background: color.pageBg }} />;
  }

  return <LandingPage />;
}
