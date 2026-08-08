import { SiteHeader } from './sections/SiteHeader';
import { Hero } from './sections/Hero';
import { HowItWorks } from './sections/HowItWorks';
import { ForEmployees } from './sections/ForEmployees';
import { ForCompanies } from './sections/ForCompanies';
import { SafetyAndPrivacy } from './sections/SafetyAndPrivacy';
import { Savings } from './sections/Savings';
import { AppEntries } from './sections/AppEntries';
import { Contact } from './sections/Contact';
import { SiteFooter } from './sections/SiteFooter';

export function App() {
  return (
    <div className="site">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">
        <Hero />
        <HowItWorks />
        <ForEmployees />
        <ForCompanies />
        <SafetyAndPrivacy />
        <Savings />
        <AppEntries />
        <Contact />
      </main>
      <SiteFooter />
    </div>
  );
}
