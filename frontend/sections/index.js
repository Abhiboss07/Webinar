/* ============================================================================
   SECTIONS — aggregates every section renderer into one `Components` object,
   keeping the same shape js/app.js expects (one render fn per section).
   Edit content in config/workshop-config.js; edit markup in the files here.
   ========================================================================== */
import { Header } from "./header.js";
import { Hero } from "./hero.js";
import { Testimonials } from "./testimonials.js";
import { Problem } from "./problem.js";
import { Modules } from "./modules.js";
import { WhyDifferent } from "./why-different.js";
import { Audience } from "./audience.js";
import { Choice } from "./choice.js";
import { Trainer } from "./trainer.js";
import { Bonus } from "./bonus.js";
import { Guarantee } from "./guarantee.js";
import { Faq } from "./faq.js";
import { FinalCta } from "./final-cta.js";
import { Footer } from "./footer.js";
import { StickyBar } from "./sticky-bar.js";
import { Popup } from "./popup.js";
import { RegistrationModal } from "./registration-modal.js";

export const Components = {
  Header, Hero, Testimonials, Problem, Modules, WhyDifferent, Audience,
  Choice, Trainer, Bonus, Guarantee, Faq, FinalCta, Footer,
  StickyBar, Popup, RegistrationModal,
};

export default Components;
