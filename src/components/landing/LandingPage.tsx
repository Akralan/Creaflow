import { bg, text } from "@/components/landing/theme";
import LandingScrollEffects from "@/components/landing/LandingScrollEffects";
import LandingHeader from "@/components/landing/LandingHeader";
import LandingHero from "@/components/landing/LandingHero";
import LandingMarquee from "@/components/landing/LandingMarquee";
import LandingProblem from "@/components/landing/LandingProblem";
import LandingHowItWorks from "@/components/landing/LandingHowItWorks";
import LandingFeatures from "@/components/landing/LandingFeatures";
import LandingPerformance from "@/components/landing/LandingPerformance";
import LandingSocialProofSlot from "@/components/landing/LandingSocialProofSlot";
import LandingPricing from "@/components/landing/LandingPricing";
import LandingFaq from "@/components/landing/LandingFaq";
import LandingCtaFinal from "@/components/landing/LandingCtaFinal";
import LandingFooter from "@/components/landing/LandingFooter";

export default function LandingPage() {
  return (
    <div style={{ position: "relative", minHeight: "100vh", background: bg.page, color: text.body }}>
      <LandingScrollEffects />
      <LandingHeader />
      <LandingHero />
      <LandingMarquee />
      <LandingProblem />
      <LandingHowItWorks />
      <LandingFeatures />
      <LandingPerformance />
      <LandingSocialProofSlot />
      <LandingPricing />
      <LandingFaq />
      <LandingCtaFinal />
      <LandingFooter />
    </div>
  );
}
