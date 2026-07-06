/* ============================================================================
   WORKSHOP CONFIG  —  BOOTSTRAP + OFFLINE FALLBACK  (content is CMS-driven)
   ----------------------------------------------------------------------------
   Content is now managed in the Admin CMS and served from the database via
   GET /api/site-config. This file is NO LONGER the source of truth for content.
   It is kept for two roles only:
     1) BOOTSTRAP — it supplies the API base URL (`api.dev` / `api.prod`) that
        js/config.js needs to know WHERE to fetch the live content from.
     2) OFFLINE FALLBACK — if the API is briefly unreachable, the public page
        still renders from these bundled values instead of showing nothing.
   It is also the one-time seed source for `backend/scripts/migrateConfig.js`.
   Edit content in the Admin CMS; only update `api.prod` (deploy URL) here.

   HOW THE FALLBACK WORKS
   • Every string can reuse "launch facts" with {{tokens}} so you set a value
     ONCE (in the `workshop` block) and it updates everywhere it appears.
       Available tokens: {{name}} {{date}} {{time}} {{venue}} {{price}}
                         {{originalPrice}} {{bonusValue}} {{brand}}
     Example: "Register Now @ {{price}}"  →  "Register Now @ ₹99"
   • Text fields may contain simple HTML (e.g. <strong>, <em>,
     <span class="text-terra">…</span>) — it renders as-is.
   • Arrays (modules, testimonials, faqs, bonuses, audience, fields) can be
     extended or trimmed freely; sections render however many items you provide.
   • "Who Should Attend" icons use keys from sections/_shared.js → ICONS:
       doctor, nurse, ot, physio, lab, student, fresher, experienced, user
   • SECURITY: only the PUBLIC Razorpay Key ID lives here (payment.keyId).
     The Key SECRET lives ONLY in the Node backend (backend/.env) — never here.
   ========================================================================== */
const WORKSHOP_CONFIG = {

  /* ------------------------------------------------------------------ BRAND */
  brand: {
    name: "Youngness Institute",   // shown in navbar + footer; token {{brand}}
    logo: "assets/logo.png",       // navbar/footer logo image
    favicon: "assets/logo.png",    // browser tab icon
  },

  /* ------------------------------------------------- WORKSHOP (LAUNCH FACTS)
     The canonical place for the core details. Change these once and they
     propagate anywhere a {{token}} is used (marquee, hero facts, CTAs, sticky
     bar, bonuses, registration, WhatsApp message, etc.). */
  workshop: {
    name: "Career Growth & Clinical Excellence Workshop", // short name → {{name}}
    date: "29 June 2026",            // {{date}}  (keep one consistent format)
    time: "10 AM – 1 PM IST",        // {{time}}
    venue: "Live Online + Offline",  // {{venue}} (e.g. "Live on Zoom" / "Chennai")
    price: "₹99",                    // {{price}}  current/registration price
    originalPrice: "₹999",           // {{originalPrice}}  struck-through price
    bonusValue: "₹9,999",            // {{bonusValue}}  total bonus stack value
    // Optional Google Map link for the venue (used in docs / future map embed).
    mapUrl: "https://maps.google.com/?q=232+Pocket+J+Sarita+Vihar+New+Delhi+110076",
  },

  /* ----------------------------------------------------- API (BACKEND) -----
     The Node/Express payment backend base URL. js/api.js auto-selects `dev`
     on localhost and `prod` everywhere else — no hardcoded URLs elsewhere. */
  api: {
    dev: "http://localhost:4000",
    prod: "https://webinar-jbgr.onrender.com", // ← your deployed Render URL
  },

  /* ------------------------------------------------------- INTEGRATIONS */
  integrations: {
    // Deployed Google Apps Script Web App URL (see google-apps-script.gs).
    // Used READ-ONLY by the browser for the social-proof popup (GET ?recent=1).
    // All WRITES go through the Node backend (which holds the shared token).
    sheetsEndpoint: "https://script.google.com/macros/s/AKfycbxJ7cQhCq_NJ9vxSB2oJGAUAK84QzVTZe9YbXsnl5V4M4459coIIJqluXd_umGplbQU/exec",
    // WhatsApp business number for the post-registration redirect (no "+").
    whatsappNumber: "919310032619",
    // Set true to log diagnostics in the console (leave false in production).
    debug: false,
  },

  /* ----------------------------------------------------------- PAYMENT -----
     Provider settings (public) + checkout copy/theming. Registration is only
     COMPLETE after a backend-verified payment. The Key SECRET lives ONLY in
     backend/.env. Razorpay Checkout exposes UPI / GPay / PhonePe / Cards /
     Net-banking / Wallets — we do NOT build separate gateways; the method
     cards below are a friendly selector that all open Razorpay. */
  payment: {
    provider: "razorpay",
    keyId: "rzp_test_xxxxxxxxxxxxx", // PUBLIC Razorpay Key ID only (never the secret)
    amount: 9900,                    // paise (₹99.00) — display price = workshop.price
    currency: "INR",
    successRedirect: "thank-you.html",
    themeColor: "#1e3d52",           // Razorpay Checkout accent
    ui: {
      badge: "Step 2 of 2 · Secure Payment",
      title: "Confirm &amp; Pay",
      sub: "Your seat is reserved. Complete payment to confirm your registration.",
      payLabel: "Pay {{price}} Securely",
      payingLabel: "Opening secure checkout…",
      secureNote: "🔒 Payments are processed securely by Razorpay. We never see or store your card details.",
      reservedNote: "Your seat stays reserved while you pay — you can resume anytime.",
      failed: "Payment couldn't be completed. Your seat is still reserved — please try again.",
      cancelled: "Payment cancelled. Your seat is still reserved — pay anytime to confirm.",
      changeLabel: "← Edit my details",
      // Friendly method selector. All cards open Razorpay (which shows the method).
      methods: [
        { id: "upi",        emoji: "📲", label: "UPI",         desc: "GPay · PhonePe · Paytm" },
        { id: "card",       emoji: "💳", label: "Card",        desc: "Credit / Debit" },
        { id: "netbanking", emoji: "🏦", label: "Net Banking", desc: "All major banks" },
        { id: "wallet",     emoji: "👛", label: "Wallets",     desc: "Paytm &amp; more" },
      ],
    },
    // Thank-you page (thank-you.html) content.
    thankYou: {
      heading: "Registration Confirmed ✅",
      sub: "Your payment has been received and your workshop seat is confirmed.",
      detailsHeading: "Your Workshop",
      supportHeading: "Need help?",
      // {email} is replaced with the registrant's email.
      emailConfirm: "A confirmation has been recorded for {email}. Your joining link &amp; bonuses will be shared on WhatsApp &amp; email before the workshop.",
      noAccess: "We couldn't find a confirmed registration. Please complete your payment from the workshop page.",
    },
  },

  /* --------------------------------------------- SEO / SOCIAL SHARE META
     Applied to <head> on load (title, description, Open Graph, Twitter). */
  seo: {
    title: "4-Hour Career Growth & Clinical Excellence Workshop | Youngness Institute",
    description: "A live 4-hour workshop for healthcare professionals — doctors, nurses, OT & lab technicians, physiotherapists and students. Get a clear career roadmap, salary-growth strategies, interview & branding skills, and AI readiness. Register now.",
    keywords: "healthcare career workshop, nursing career growth, doctor career workshop, OT technician course, physiotherapy career, healthcare interview preparation, allied health workshop India",
    ogImage: "assets/IMG_5272.jpg",                  // social share preview image
    canonical: "https://awishclinic.com/workshop/",
    themeColor: "#0f2433",                           // mobile browser chrome color
  },

  /* Shared note shown under most "Register" buttons. */
  ctaNote: 'Register now and unlock bonuses worth <span class="text-terra">{{bonusValue}}</span>',

  /* ----------------------------------------- TOP ANNOUNCEMENT MARQUEE */
  marquee: {
    message: "🚀 {{name}} • {{date}} • {{time}} • Register Now 📅",
    repeat: 4,   // copies per group (two groups loop seamlessly) — raise for very wide screens
  },

  /* ------------------------------------------------------- STICKY NAVBAR */
  header: { cta: "Register Now" },   // navbar button label

  /* ============================ 1 · HERO ============================ */
  hero: {
    attentionLabel: "🚀 Youngness Institute Presents",                 // lead-in pill (presenter)
    attentionText: "For Doctors, Nurses, Technicians, Physios, Freshers &amp; Students",
    title: "Career Growth &amp; Clinical Excellence:",                 // big headline (line 1)
    subtitle: "The 4-Hour Workshop That Helps You Grow Faster In Healthcare", // green sub-headline
    description: "A practical, no-fluff session that gives you a clear career roadmap, higher-income strategies, interview &amp; branding mastery, and the AI skills to stay ahead — built only for healthcare careers.",
    primaryCta: "Register Now @ {{price}}",                            // hero button
    bonusNote: 'Unlock bonuses worth <span class="text-terra">{{bonusValue}}</span>',
    // Hero trainer image — shows WHO is conducting the workshop (builds trust).
    // Use a portrait photo; it renders in a framed 3:4 box (no face cropping).
    // Tip: keep it optimized (<300 KB) for fast mobile load. Replace in /assets.
    image: "assets/Main_Doctor.jpg",
    imageAlt: "Your workshop trainer — practising doctor in clinic",
    imageBadge: "👨‍⚕️ Your Workshop Trainer",   // small caption shown above the trainer name
    // Workshop info cards — rendered as a 2×2 grid beside the trainer image.
    // Each card: emoji + label (small caps) + value. Edit/add/remove freely.
    facts: [
      { emoji: "📅", label: "Date", value: "{{date}}" },
      { emoji: "⏰", label: "Time", value: "{{time}}" },
      { emoji: "💻", label: "Mode", value: "{{venue}}" },
      { emoji: "🪑", label: "Seats", value: "Limited" },
    ],
  },

  /* ================ 2 · SUCCESS STORIES / TESTIMONIALS ================ */
  testimonials: {
    label: "Success Stories",
    heading: "What Our Healthcare Professionals Say",
    cta: "Register Now @ Just {{price}}",
    // 2×2 video grid. `thumb` = image path; replace with real testimonial thumbnails.
    videos: [
      { name: "Priya · Staff Nurse",      thumb: "assets/IMG_4641.jpg" },
      { name: "Rahul · Physiotherapist",  thumb: "assets/IMG_5272.jpg" },
      { name: "Sneha · Lab Technician",   thumb: "assets/IMG_5290.jpg" },
      { name: "Arjun · OT Technician",    thumb: "assets/IMG_4567.jpg" },
    ],
    // Text reviews. initials → avatar circle; quote may contain <strong>.
    reviews: [
      { initials: "PN", name: "Priya Nair",     role: "Staff Nurse → Senior Nurse", quote: '"I finally understood <strong>why</strong> my applications were ignored. Rebuilt my resume in the workshop and got two interview calls within a month."' },
      { initials: "RK", name: "Rahul Kulkarni", role: "Physiotherapist",            quote: '"The salary-growth module alone was worth it. I negotiated a <strong>40% higher</strong> package at my next hospital with full confidence."' },
      { initials: "SD", name: "Sneha Das",      role: "Lab Technician, Fresher",    quote: '"As a fresher I had zero direction. Walked out with a 12-month roadmap and the exact certifications to pursue. Game-changer."' },
    ],
  },

  /* ===================== 3 · PROBLEM ("If You Are…") ===================== */
  problem: {
    label: "Be Honest…",
    heading: "If You Are…",
    items: [   // checklist of pain points — add/remove freely
      "Stuck in the same role for years with slow career growth",
      "Frustrated that your salary isn't growing the way it should",
      "Unsure which roles, hospitals or specializations to aim for",
      "Getting interview calls but unable to convert them into offers",
      "Confused about international / abroad opportunities",
      "Worried about being left behind by AI &amp; new technology",
      "Lacking a personal brand, strong resume or LinkedIn presence",
    ],
    punchline: 'If you checked <span class="text-terra">more than two boxes</span>, you\'re not alone — but this is your moment to make the right decision. Fix your career system. Start growing for real.',
    cta: "Yes, I Want To Fix This — Register Now",
  },

  /* ================== 4 · WHAT YOU WILL LEARN (MODULES) ================== */
  modules: {
    label: "4-Hour Masterclass · Premium Gold Edition",
    heading: "What You Will Learn",
    cta: "Register Now @ Just {{price}}",
    // Each module: title + lessons[]. Add highlight:true to make one the gold card.
    items: [
      { title: "Healthcare Industry Opportunities", lessons: [
        "Current demand across hospitals &amp; allied health",
        "The fastest-growing career pathways in 2026",
        "Global opportunities — Gulf, UK, Europe, Australia",
      ]},
      { title: "Skills That Hospitals Look For", lessons: [
        "Patient &amp; team communication that builds trust",
        "Clinical documentation done right",
        "Core OT protocols every professional should know",
        "ICU protocols &amp; critical-care readiness",
      ]},
      { title: "Career Acceleration Blueprint", lessons: [
        "Resume building that beats the screening pile",
        "Interview preparation &amp; confident answers",
        "LinkedIn optimization for healthcare roles",
        "Personal branding that opens doors",
      ]},
      { title: "Higher Income &amp; Growth Strategies", lessons: [
        "Certifications that genuinely raise your value",
        "Choosing the right specialization for you",
        "A 12-month growth roadmap you can follow",
      ]},
      { title: "AI &amp; Technology In Healthcare", highlight: true, lessons: [
        "AI tools every healthcare professional should use",
        "The future skills that will matter most",
        "Digital healthcare, EMRs &amp; telemedicine basics",
      ]},
    ],
  },

  /* ================= 5 · WHY THIS WORKSHOP IS DIFFERENT =================
     Three columns. variant: "bad" (✗ list), "good" (gold ✓ card), "arrow" (→ list). */
  whyDifferent: {
    label: "The Difference",
    heading: "Why This Workshop Is Different",
    columns: [
      { variant: "bad", title: "Most career advice focuses on:", note: "…which leaves you exactly where you started.", points: [
        "Generic tips that don't fit healthcare",
        "\"Work hard and wait\" with no real plan",
        "Theory with nothing to act on",
      ]},
      { variant: "good", title: "This workshop focuses on:", note: "…so you stop guessing and start moving.", points: [
        "How healthcare careers <em>actually</em> grow",
        "What hiring managers truly look for",
        "A clear, do-it-now action plan",
      ]},
      { variant: "arrow", title: "And from there:", note: "Real momentum, not random effort.", points: [
        "Your profile becomes stronger",
        "Your confidence becomes stable",
        "Your growth becomes consistent",
      ]},
    ],
  },

  /* ===================== 6 · WHO SHOULD ATTEND ===================== */
  audience: {
    label: "Built For You",
    heading: "Who Should Attend",
    items: [   // icon key + title (see ICONS list in the header comment)
      { icon: "doctor",      title: "Doctors" },
      { icon: "nurse",       title: "Nurses" },
      { icon: "ot",          title: "OT Technicians" },
      { icon: "physio",      title: "Physiotherapists" },
      { icon: "lab",         title: "Lab Technicians" },
      { icon: "student",     title: "Students" },
      { icon: "fresher",     title: "Freshers" },
      { icon: "experienced", title: "Experienced Pros" },
    ],
  },

  /* ===================== 7 · YOUR CHOICE TODAY ===================== */
  choice: {
    label: "Decision Time",
    heading: "Your Choice Today",
    bad:  { tag: "Option 1 · Stay Where You Are", result: "Result: Same cycle, more frustration",
      text: "Another year goes by. Same role, same salary. You watch juniors get promoted, send applications that get ignored, and quietly wonder if you've missed your window. The fear of being left behind grows — and nothing changes." },
    good: { tag: "Option 2 · A Different Path", result: "Result: Clarity, confidence &amp; momentum",
      text: "You spend 4 focused hours and walk out with a clear roadmap, a stronger profile, confident interview answers, and AI working <em>for</em> you. You stop guessing. You start growing — with direction and certainty." },
    final: { title: "🔥 The Final Decision", cta: "I Choose Option 2 — Register Now",
      text: 'One path keeps you stuck in the same cycle. The other changes how you grow — and ultimately how far you go. For just <strong class="text-terra">{{price}}</strong>, which will you choose?' },
  },

  /* ================ 8 · MEET THE COACH / TRAINER ================
     A single featured trainer. image, name, designation, bio[] paragraphs,
     achievements[] bullet points. */
  trainer: {
    label: "Your Mentor",
    heading: "Meet Your Trainer",
    image: "assets/Main_Doctor.jpg",
    name: "Dr. Awish",                              // founder of Youngness Institute
    designation: "Founder &amp; Lead Trainer",       // role (org shown separately)
    experience: "10+ Years in Clinical Training &amp; Mentoring",
    organization: "Youngness Institute",            // also shown under the hero image
    bio: [
      "Dr. Awish is the founder of Youngness Institute, where healthcare professionals train through hands-on clinical learning, real-world mentoring and a UGC-approved academic framework associated with KM University.",
      "Over 10+ years he has guided doctors, nurses, technicians and allied-health professionals to grow faster in their careers — pairing clinical excellence with practical, do-it-now guidance on skills, specialization, interviews and placement.",
    ],
    achievements: [
      "10+ years of clinical &amp; training experience",
      "1,000+ healthcare professionals trained",
      "UGC-approved framework · assoc. KM University",
      "Placement &amp; career support across 3 centers",
    ],
  },

  /* ===================== 9 · BONUS OFFERS ===================== */
  bonus: {
    label: "Register &amp; Unlock",
    heading: 'Bonus Offers Worth <span class="text-gold">{{bonusValue}}</span>',
    sub: "Every registrant gets the complete bonus stack — free with {{price}} registration.",
    // Each card: title, desc, value (struck-through). "Bonus N" numbering is automatic.
    items: [
      { title: "Healthcare Resume Template",   desc: "A recruiter-ready resume template tailored for healthcare roles.",            value: "Worth ₹1,999" },
      { title: "Interview Mastery Guide",      desc: "The most-asked healthcare interview questions with model answers.",           value: "Worth ₹2,499" },
      { title: "Career Roadmap PDF",           desc: "A 12-month, step-by-step growth plan you can start immediately.",             value: "Worth ₹1,999" },
      { title: "Certificate of Participation", desc: "An official {{brand}} certificate for your profile &amp; LinkedIn.",          value: "Worth ₹1,500" },
      { title: "Healthcare Community Access",  desc: "A private network of healthcare professionals, jobs &amp; peer support.",     value: "Worth ₹2,002" },
    ],
    total: { label: "Total Value", amount: "{{bonusValue}}", note: "Yours FREE with {{price}}", cta: "Claim My Bonuses" },
  },

  /* ===================== 10 · GUARANTEE ===================== */
  guarantee: {
    badge: "Risk-Free Registration",
    heading: 'Your Career Growth, <span class="text-clinic">Zero Risk.</span>',
    text: "If the workshop doesn't give you practical value, just write to us. You should only pay for what genuinely moves your career forward.",
    points: ["Practical Career Guidance", "Actionable Roadmap", "No Hidden Conditions"],
    cta: "Register Now @ {{price}}",
  },

  /* ===================== 11 · FAQ ===================== */
  faq: {
    label: "Got Questions?",
    heading: "Frequently Asked Questions",
    items: [   // q + a, add/remove freely
      { q: "Is this workshop for freshers?", a: "Absolutely. Freshers and students gain the most — you'll leave with a clear roadmap, the right certifications to pursue, and how to land your first strong role." },
      { q: "Will I get a certificate?", a: "Yes — every participant receives an official {{brand}} Certificate of Participation you can add to your resume and LinkedIn." },
      { q: "Is it online or offline?", a: "Both. Join the live online session from anywhere, or attend in person. Choose your preferred mode while registering." },
      { q: "Can doctors and nurses attend together?", a: "Yes. The workshop is designed for the entire healthcare ecosystem — the career principles apply across all roles, and each person registers individually." },
      { q: "Will there be a live Q&amp;A?", a: "Yes. There's a dedicated live Q&amp;A so you can ask about your specific situation and get clarity in real time." },
    ],
  },

  /* ===================== 12 · FINAL CTA ===================== */
  finalCta: {
    heading: "Your Career Growth Depends On The Skills You Build Today.",
    sub: "Join hundreds of healthcare professionals taking the next step in their careers. Four hours could change your next ten years.",
    cta: "Register Now @ {{price}}",
    badges: ["🎁 {{bonusValue}} Bonuses", "🔒 Secure Registration", "⚡ Limited Seats"],
  },

  /* ===================== FOOTER / CONTACT ===================== */
  footer: {
    about: "Helping healthcare professionals grow faster through practical career skills, clinical excellence and future-ready training.",
    quickLinks: [
      { label: "Success Stories", href: "#stories" },
      { label: "FAQ", href: "#faq" },
    ],
    contact: {
      heading: "Contact",
      addressLines: ["232, Pocket J, Sarita Vihar,", "New Delhi, Delhi 110076"],
      phone: "+91 9310032619",        // display text
      phoneTel: "+919310032619",      // tel: link (no spaces)
      email: "info@awishclinic.com",
    },
    copyright: "© 2026 Youngness Institute. All rights reserved.",
    disclaimer: "Results vary by individual effort. This workshop provides guidance and is not a guarantee of employment or income.",
  },

  /* ===================== STICKY MOBILE CTA ===================== */
  sticky: { title: "4-Hr Career Workshop · {{price}}", subtitle: "{{date}} · Seats filling fast", cta: "Register Now" },

  /* ===================== SOCIAL-PROOF POPUP =====================
     Rotating "First-name from City just booked" toast.
     Shows ONLY real registrations pulled live from your Google Sheet
     (via integrations.sheetsEndpoint — the same sheet the form writes to).
     Privacy: first name + city only — never full name, phone or email.
     If there are no real registrations yet (or the endpoint isn't set),
     the popup stays completely hidden — it NEVER shows fake/demo data.
     Set enabled:false to switch it off entirely. */
  popup: {
    enabled: true,
    tag: "Recently registered",
    suffix: "just booked a seat 🎉",
  },

  /* ===================== REGISTRATION FORM (MODAL) =====================
     Add/remove fields freely — each renders + validates automatically and
     becomes a Google Sheet column on submit.
     Field options:
       name        unique key (also the Sheet column + WhatsApp {placeholder})
       label       visible label
       type        "text" | "tel" | "email" | "select"
       required    true/false
       half        true → half-width (pairs sit side-by-side)
       options     [..] for selects
       prefix      e.g. "+91" (shown before a tel input)
       maxlength   character cap
       inputmode   keyboard hint, e.g. "numeric"
       minLength   minimum characters
       validate    "mobileIN" → 10-digit Indian mobile check
       placeholder / autocomplete  standard input hints                       */
  registration: {
    badge: "Secure Registration · {{price}}",
    title: "Confirm Your Seat",
    sub: "+ unlock bonuses worth {{bonusValue}} · takes 30 seconds",
    submitLabel: "Register Now @ {{price}}",
    securityNote: "🔒 100% secure · By registering you agree to receive workshop details on WhatsApp &amp; email.",
    fields: [
      { name: "fullName",   label: "Full Name",      type: "text",   required: true, minLength: 2, autocomplete: "name",            placeholder: "e.g. Priya Nair" },
      { name: "mobile",     label: "Mobile Number",  type: "tel",    required: true, prefix: "+91", maxlength: 10, inputmode: "numeric", validate: "mobileIN", autocomplete: "tel", placeholder: "10-digit mobile number" },
      { name: "email",      label: "Email Address",  type: "email",  required: true, autocomplete: "email",          placeholder: "you@example.com" },
      { name: "profession", label: "Profession",     type: "select", required: true, half: true, options: ["Doctor","Nurse","OT Technician","Physiotherapist","Lab Technician","Healthcare Student","Allied Healthcare","Other"] },
      { name: "city",       label: "City",           type: "text",   required: true, minLength: 2, half: true, autocomplete: "address-level2", placeholder: "e.g. Chennai" },
      { name: "experience", label: "Experience",     type: "select", required: true, half: true, options: ["Student / Fresher","0–2 years","3–5 years","6–10 years","10+ years"] },
      { name: "mode",       label: "Preferred Mode", type: "select", required: true, half: true, options: ["Online (Live)","Offline","Either works"] },
    ],
    // Success popup — shown ONLY after payment is verified (see `payment`).
    success: {
      title: "Registration Successful! 🎉",
      text: "Payment received successfully — your seat for the {{name}} is confirmed. Your registration is complete.",
      whatsappLabel: "Get Details on WhatsApp",
      detailsLabel: "View Workshop Details",
      doneLabel: "Done",
    },
    // {placeholders} are replaced with the registrant's submitted field values.
    whatsappTemplate: "Hi! I just registered for the {{name}} ({{date}}).\n\nName: {fullName}\nProfession: {profession}\nCity: {city}\n\nPlease share my joining link & bonuses.",
  },
};

// Expose globally for non-module readers (e.g. inline scripts), and export for
// ES-module imports (js/config.js, thank-you.html).
if (typeof window !== "undefined") window.WORKSHOP_CONFIG = WORKSHOP_CONFIG;
export default WORKSHOP_CONFIG;
