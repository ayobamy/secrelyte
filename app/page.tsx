import './landing.css';
import { ClaudeSection } from '@/components/landing/claude-section';
import { Closing } from '@/components/landing/closing';
import { Evidence } from '@/components/landing/evidence';
import { Faq } from '@/components/landing/faq';
import { Guarantee } from '@/components/landing/guarantee';
import { Hero } from '@/components/landing/hero';
import { HowItWorks } from '@/components/landing/how-it-works';
import { Limits } from '@/components/landing/limits';
import { Pain } from '@/components/landing/pain';
import { RevealOnScroll } from '@/components/landing/reveal-on-scroll';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

/**
 * The story, one job per section: the guarantee and a live vault above the fold, the pain,
 * the guarantee as a diagram, how it works, Claude as the interface (Next), evidence, limits,
 * FAQ, and a closing call to action. Every capability is labelled Live or Next.
 */
export default function Home() {
  return (
    <div className="landing relative flex min-h-full flex-col">
      <SiteHeader />
      <main id="content" className="flex-1">
        <Hero />
        <Pain />
        <Guarantee />
        <HowItWorks />
        <ClaudeSection />
        <Evidence />
        <Limits />
        <Faq />
        <Closing />
      </main>
      <SiteFooter />
      <RevealOnScroll />
    </div>
  );
}
