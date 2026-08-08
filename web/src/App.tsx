import { SiteHeader } from './sections/SiteHeader';
import { Hero } from './sections/Hero';
import { Mission } from './sections/Mission';
import { Impact } from './sections/Impact';
import { HowItWorks } from './sections/HowItWorks';
import { Marquee } from './sections/Marquee';
import { ForEmployees } from './sections/ForEmployees';
import { Fleet } from './sections/Fleet';
import { ForCompanies } from './sections/ForCompanies';
import { SafetyAndPrivacy } from './sections/SafetyAndPrivacy';
import { Savings } from './sections/Savings';
import { Reviews } from './sections/Reviews';
import { AppEntries } from './sections/AppEntries';
import { Contact } from './sections/Contact';
import { SiteFooter } from './sections/SiteFooter';

/**
 * Public marketing site. Section order follows the reference design's page
 * rhythm — forest hero, mint explanation, dark proof band, inset diagram,
 * marquee, alternating benefit panels, reviews, app promo, contact, footer —
 * carrying the sections the brief requires.
 */
export function App() {
  return (
    <div className="site">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">
        <Hero />
        <Mission />
        <Impact />
        <HowItWorks />
        <Marquee />
        <ForEmployees />
        <Fleet />
        <ForCompanies />
        <SafetyAndPrivacy />
        <Savings />
        <Reviews />
        <AppEntries />
        <Contact />
      </main>
      <SiteFooter />
    </div>
  );
}
