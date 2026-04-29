import { Navbar } from "./Navbar";
import { Hero } from "./Hero";
import { Trust } from "./Trust";
import { FeatureSplit } from "./FeatureSplit";
import { GalleryGrid } from "./GalleryGrid";
import { InteriorBanner } from "./InteriorBanner";
import { SecondarySplit } from "./SecondarySplit";
import { DoubleCompare } from "./DoubleCompare";
import { CTASection } from "./CTASection";
import { Footer } from "./Footer";

export function LandingPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Trust />
        <FeatureSplit />
        <GalleryGrid />
        <InteriorBanner />
        <SecondarySplit />
        <DoubleCompare />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
