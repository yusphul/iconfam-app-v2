"use client";

import Link from "next/link";
import Image from "next/image";
import Reveal from "@/components/Reveal";
import Logo from "@/components/Logo";
import ContactEmail from "@/components/ContactEmail";
import ContactForm from "@/components/ContactForm";

const WHAT_WE_DO = [
  {
    title: "Property/Land verification",
    body: "Title search, seller and developer legitimacy, and a physical check of the site — before you send money.",
    icon: "M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z",
    image: "/wwd-land-verification.jpg",
    alt: "A surveyor reviewing a plotted land boundary on a tablet beside a staked-out parcel and GPS surveying equipment",
  },
  {
    title: "Property Documentation",
    body: "Deed of assignment, registered survey plan verification and documentation, regularization, C of O, governor's consent.",
    icon: "M6 3h9l3 3v15H6z M9 10h6 M9 14h6",
    image: "/wwd-documentation.jpg",
    alt: "Title deed, survey plan, and land agreement documents being reviewed and signed at a desk alongside a model house",
  },
  {
    title: "Site Inspection",
    body: "Independent physical site progress inspection sign-off at each stage (e.g. foundation, block setting, roofing, etc.) of construction from foundation to finishing.",
    icon: "M9 12l2 2 4-4M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z",
    image: "/wwd-site-inspection.jpg",
    alt: "Two inspectors in hard hats reviewing a building blueprint on site in front of a house under construction",
  },
  {
    title: "Farm & agribusiness oversight",
    body: "Land, crop, and harvest condition, verified in person for diaspora-funded or diaspora-owned farms.",
    icon: "M12 2v20M6 8c0 6 6 6 6 6s6 0 6-6",
    image: "/wwd-farm.jpg",
    alt: "A farm manager reviewing crop and irrigation data on a tablet in a field, with workers, a tractor, and grain silos in the background",
  },
];

// Placeholder testimonials — swap for real, permissioned client quotes before this
// page goes live publicly. Attributed by context rather than invented names/photos.
const HOW_IT_WORKS = [
  {
    title: "Tell us what to check",
    body: "Sign up and describe what you need verified — a property, a build, or a farm.",
    icon: "M6 3h9l3 3v15H6z M9 10h6 M9 14h6",
  },
  {
    title: "We verify & inspect",
    body: "A licensed professional checks the paperwork; a field agent visits the site in person.",
    icon: "M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z",
  },
  {
    title: "Get your report",
    body: "Plain-language findings with photo evidence — reviewed by us before it reaches you.",
    icon: "M9 12l2 2 4-4 M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  },
  {
    title: "Proceed with confidence",
    body: "Approve the next payment or milestone, knowing exactly what's real on the ground.",
    icon: "M20 6L9 17l-5-5",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "I've paid for a survey and a purchase agreement, but nobody has confirmed the paperwork is actually moving. Having someone independent check on that would change whether I send the next payment.",
    context: "Prospective client — pending Certificate of Occupancy, Lagos",
  },
  {
    quote:
      "It depends on persons to confirm another person's work — most people have price tags. That's the real risk to get right.",
    context: "Early access sign-up, on what would make this trustworthy",
  },
  {
    quote:
      "I've sent money for materials before and had no way to know if what showed up on site actually matched what I paid for. I just had to take the contractor's word for it.",
    context: "Prospective client — ground-up build, diaspora investor",
  },
];

// Internal team access — deliberately not marketed on the public page. These are
// employees/contractors, not something a prospective client should be choosing
// between when they land here.
const STAFF_ROLES = [
  { key: "agent", label: "Field agent" },
  { key: "professional", label: "Professional" },
  { key: "admin", label: "Admin" },
];

// Three rings pulsing outward, centered behind the phone mockup — same
// "something being actively verified" idea as before, now orbiting a real
// preview of the product instead of a bare marker dot.
function OrbitRings({ size }: { size: number }) {
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span className="ping-ring absolute inset-0 rounded-full border-2 border-survey/50" />
      <span
        className="ping-ring absolute inset-0 rounded-full border-2 border-survey/50"
        style={{ animationDelay: "1.05s" }}
      />
      <span
        className="ping-ring absolute inset-0 rounded-full border-2 border-survey/50"
        style={{ animationDelay: "2.1s" }}
      />
    </div>
  );
}

// A simplified, real preview of the client portal — not a generic phone stock
// image. Deliberately built from divs/text rather than a screenshot, so it
// costs nothing to load and never goes stale against the real UI.
function PhoneMockup() {
  return (
    <div
      className="relative z-10 aspect-[9/19.5] w-[250px] -rotate-[4deg] rounded-[3rem] border-[3px] border-chalk bg-chalk p-1.5 transition-transform duration-500 hover:rotate-0"
      style={{ boxShadow: "0 30px 60px -15px rgba(16,24,40,0.35)" }}
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-[2.75rem] bg-white">
        {/* Dynamic Island, with the time/status icons flanking it at the same
            height — not stacked above/below, which is how it collides on a
            real device too. */}
        <div className="absolute left-1/2 top-3 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-chalk" />
        <span className="absolute left-4 top-4 text-[9px] font-medium text-slateSoft">9:41</span>
        <span className="absolute right-4 top-4 text-[9px] font-medium text-slateSoft">••••</span>

        <div className="flex-1 px-3.5 pb-4 pt-11">
          <div className="mb-3 font-display text-[11px] font-bold">
            <span className="text-survey">i</span>
            <span className="text-chalk">Confam</span>
          </div>
          <div className="rounded-xl border border-blueprintLine bg-blueprint p-2.5">
            <p className="text-[10px] font-semibold leading-tight text-chalk">
              Adeyemi — C of O status
            </p>
            <span className="mt-1.5 inline-block rounded-full bg-survey/15 px-2 py-0.5 text-[8px] font-medium text-surveyLight">
              In Progress
            </span>
            <div className="mt-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-benchmark" />
                <span className="h-1.5 flex-1 rounded-full bg-benchmark/30" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blueprintLine" />
                <span className="h-1.5 flex-1 rounded-full bg-blueprintLine" />
              </div>
            </div>
          </div>
          <div className="mt-2.5 rounded-xl border border-blueprintLine bg-white p-2.5">
            <span className="inline-block rounded-full bg-benchmark/15 px-2 py-0.5 text-[8px] font-medium text-benchmark">
              Confirmed Good
            </span>
            <div className="mt-2 h-1.5 w-full rounded-full bg-blueprintLine" />
            <div className="mt-1 h-1.5 w-3/4 rounded-full bg-blueprintLine" />
          </div>
        </div>

        {/* Bottom tab bar + home indicator — fills the reserved height
            naturally and reads as unmistakably "iPhone app," not just a
            tall white rectangle. */}
        <div className="flex items-center justify-around border-t border-blueprintLine py-3">
          <span className="h-2 w-2 rounded-full bg-survey" />
          <span className="h-2 w-2 rounded-full bg-blueprintLine" />
          <span className="h-2 w-2 rounded-full bg-blueprintLine" />
          <span className="h-2 w-2 rounded-full bg-blueprintLine" />
        </div>
        <div className="flex justify-center pb-2">
          <span className="h-1 w-24 rounded-full bg-chalk/25" />
        </div>
      </div>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="group relative text-sm text-slateSoft transition-colors duration-200 hover:text-chalk"
    >
      {children}
      <span className="absolute -bottom-1 left-0 h-px w-0 bg-survey transition-all duration-200 group-hover:w-full" />
    </a>
  );
}

export default function RoleGateway() {
  return (
    <div className="relative min-h-screen bg-blueprint font-body text-chalk">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-blueprintLine bg-blueprint/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <a href="#top">
            <Logo height={32} />
          </a>
          <nav className="hidden items-center gap-8 sm:flex">
            <NavLink href="#what-we-do">What we do</NavLink>
            <NavLink href="#how-it-works">How it works</NavLink>
            <NavLink href="#testimonials">Testimonials</NavLink>
            <NavLink href="#contact">Contact us</NavLink>
          </nav>
          <div className="flex items-center gap-4">
            <Link
              href="/login?role=client"
              className="hidden text-sm font-medium text-slateSoft transition-colors duration-200 hover:text-chalk sm:inline"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-survey px-4 py-1.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-surveyLight"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section id="top" className="relative isolate flex min-h-[600px] items-center overflow-hidden md:min-h-[680px]">
        <Image
          src="/hero-construction.jpg"
          alt="A single-family home under construction on a residential site in Nigeria, showing the perimeter fence, a worker preparing rebar for the driveway, and building materials on site"
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-footerBg/95 via-footerBg/75 to-footerBg/25" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-footerBg/60 via-transparent to-transparent" />

        <div className="relative mx-auto w-full max-w-6xl px-6 py-20 md:py-24">
          <div className="max-w-xl">
            <span
              className="gateway-rise inline-block rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white backdrop-blur-sm"
              style={{ animationDelay: "300ms" }}
            >
              For the diaspora. For a safer tomorrow
            </span>
            <h1
              className="gateway-rise mt-4 font-display text-4xl font-bold leading-tight text-white sm:text-5xl"
              style={{ animationDelay: "450ms" }}
            >
              Before You Send
              <br />
              That Money Home,
              <br />
              <span className="text-survey">Confam Am.</span>
            </h1>
            <p
              className="gateway-rise mt-5 max-w-lg text-base text-white/80"
              style={{ animationDelay: "600ms" }}
            >
              We verify the paperwork, inspect the site, and confirm the project is
              real — before you pay, and at every milestone until completion.
            </p>
            <div className="gateway-rise mt-8 flex flex-wrap gap-3" style={{ animationDelay: "750ms" }}>
              <Link
                href="/signup"
                className="rounded-full bg-survey px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-surveyLight hover:shadow-lg hover:shadow-survey/30"
              >
                Get started
              </Link>
              <a
                href="#what-we-do"
                className="rounded-full border border-white/30 px-5 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:border-white hover:bg-white/10"
              >
                What we do
              </a>
            </div>
            <div
              className="gateway-rise mt-9 flex flex-wrap gap-x-6 gap-y-3"
              style={{ animationDelay: "850ms" }}
            >
              {[
                { label: "Verified Projects", icon: "M9 12l2 2 4-4M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" },
                { label: "On-Ground Inspections", icon: "M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" },
                { label: "Transparent Reports", icon: "M6 3h9l3 3v15H6z M9 10h6 M9 14h6" },
              ].map((t) => (
                <div key={t.label} className="flex items-center gap-2 text-xs font-semibold text-white">
                  <svg className="h-4 w-4 text-survey" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d={t.icon} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {t.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* What we do */}
      <section id="what-we-do" className="border-t border-blueprintLine">
        <Reveal className="mx-auto max-w-6xl px-6 py-12">
          <h2 className="font-display text-2xl font-semibold">What we do</h2>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {WHAT_WE_DO.map((item) => (
              <div
                key={item.title}
                className="group overflow-hidden rounded-2xl border border-blueprintLine bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-survey/40 hover:shadow-lg"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={item.image}
                    alt={item.alt}
                    fill
                    sizes="(min-width: 640px) 45vw, 90vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-chalk/30 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition-colors duration-300 group-hover:bg-survey">
                    <svg
                      className="h-4 w-4 text-survey transition-colors duration-300 group-hover:text-white"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d={item.icon} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
                <div className="p-6">
                  <div className="h-1 w-10 rounded-full bg-survey" />
                  <h3 className="mt-4 font-display text-base font-semibold text-chalk">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slateSoft">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="relative overflow-hidden border-t border-blueprintLine bg-sectionTint">
        {/* Background design — a faint blueprint dot-grid plus two soft color
            washes, echoing the survey/blueprint motif used in the hero without
            competing with the white cards sitting on top of it. */}
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage: "radial-gradient(circle, #CBD5DD 1.5px, transparent 1.5px)",
            backgroundSize: "26px 26px",
          }}
        />
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-survey/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-benchmark/10 blur-3xl" />

        <Reveal className="relative mx-auto max-w-5xl px-6 py-12">
          <p className="text-sm font-medium text-survey">How it works</p>
          <h2 className="mt-2 font-display text-2xl font-semibold">
            A safer, simpler way to send money home
          </h2>
          <p className="mt-2 max-w-lg text-sm text-slateSoft">
            Four steps between deciding to invest and knowing it&apos;s real.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={step.title} className="how-item group relative">
                <div className="how-card relative h-full overflow-hidden rounded-2xl border border-blueprintLine bg-white p-6 shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:border-survey/40 group-hover:shadow-lg">
                  {/* Large background number — a design flourish that also
                      doubles as the step counter, instead of a small floating
                      badge sitting outside the card. */}
                  <span className="pointer-events-none absolute -right-1 -top-3 font-display text-6xl font-bold text-blueprint transition-colors duration-300 group-hover:text-survey/10">
                    0{i + 1}
                  </span>

                  <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-survey/10 transition-colors duration-300 group-hover:bg-survey">
                    <svg
                      className="h-5 w-5 text-survey transition-colors duration-300 group-hover:text-white"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d={step.icon} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <h3 className="relative mt-4 font-display text-base font-semibold text-chalk">
                    {step.title}
                  </h3>
                  <p className="relative mt-1.5 text-sm leading-relaxed text-slateSoft">{step.body}</p>
                </div>

                {/* Arrow connector between cards — sits in the gap between grid
                    cells (outside the card's own overflow-hidden) so it isn't
                    clipped, and shows the sequence without a line running
                    behind everything. */}
                {i < HOW_IT_WORKS.length - 1 && (
                  <span className="pointer-events-none absolute -right-4 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-blueprintLine bg-white text-survey shadow-md transition-colors duration-300 group-hover:border-survey/40 lg:flex">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Sign in — client-facing only. Field agents, professionals, and admin are
          iConfam's internal team, not something a visiting prospect should be
          choosing between here — their access lives quietly in the footer instead. */}
      <section
        id="signin"
        className="relative overflow-hidden border-t border-blueprintLine bg-sectionTint"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            backgroundImage: "radial-gradient(circle, #CBD5DD 1.5px, transparent 1.5px)",
            backgroundSize: "28px 28px",
          }}
          aria-hidden="true"
        />

        <Reveal className="relative mx-auto grid max-w-5xl grid-cols-1 items-center gap-12 px-6 py-12 md:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-semibold leading-tight text-chalk sm:text-4xl">
              See exactly what&apos;s happening with your case.
            </h2>
            <p className="mt-4 max-w-md text-base text-slateSoft">
              Milestones, reports, and payments — all in one place, updated the
              moment something changes.
            </p>
            <a
              href="#what-we-do"
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-survey transition-colors duration-200 hover:text-surveyLight"
            >
              See what we verify
              <span aria-hidden="true">→</span>
            </a>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/signup"
                className="inline-block rounded-full bg-chalk px-7 py-3 text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 hover:shadow-lg"
              >
                Get started
              </Link>
              <Link
                href="/login?role=client"
                className="text-sm font-medium text-slateSoft transition-colors duration-200 hover:text-chalk"
              >
                Already have an account? Sign in
              </Link>
            </div>
          </div>

          <div className="phone-stage relative flex justify-center py-10 md:py-4">
            <OrbitRings size={640} />
            <PhoneMockup />
          </div>
        </Reveal>
      </section>

      {/* Testimonials — an auto-scrolling marquee. The row is the testimonials
          rendered twice back to back; the animation translates it by exactly
          -50%, which is exactly one full set, so the loop is seamless — the
          second copy is already in the position the first one just left. */}
      <section id="testimonials" className="overflow-hidden border-t border-blueprintLine">
        <Reveal className="mx-auto max-w-5xl px-6 pt-12">
          <h2 className="font-display text-2xl font-semibold">What people are telling us</h2>
          <p className="mt-2 max-w-lg text-sm text-slateSoft">
            iConfam is early — this is real feedback from the people we've talked to
            while building it, not polished praise.
          </p>
        </Reveal>

        <div
          className="relative mt-10 overflow-hidden pb-12"
          style={{
            maskImage: "linear-gradient(to right, transparent, black 5%, black 95%, transparent)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent, black 5%, black 95%, transparent)",
          }}
        >
          <div className="marquee-track flex w-max gap-6 px-6">
            {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
              <div
                key={i}
                className="w-80 shrink-0 rounded-2xl border border-blueprintLine bg-white p-6 shadow-sm"
              >
                <p className="text-sm leading-relaxed text-chalk">&ldquo;{t.quote}&rdquo;</p>
                <p className="mt-4 text-xs text-slateSoft">{t.context}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="border-t border-blueprintLine">
        <Reveal className="mx-auto max-w-5xl px-6 py-12">
          <h2 className="font-display text-2xl font-semibold">Contact us</h2>
          <p className="mt-2 max-w-md text-sm text-slateSoft">
            Have a property, build, land or farm you want to verify, or a question
            before you sign in? Send us a message.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1.2fr_1fr]">
            <ContactForm />

            <div className="rounded-2xl border border-blueprintLine bg-sectionTint/60 p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-slateSoft">
                Prefer email or WhatsApp?
              </p>
              <div className="mt-4 flex flex-col gap-3">
                <ContactEmail
                  subject="Verification inquiry"
                  className="inline-flex w-fit rounded-full border border-blueprintLine bg-white px-5 py-2.5 text-sm font-medium text-chalk transition-colors duration-200 hover:border-survey"
                />
                <a
                  href="https://wa.me/12816704862"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-fit rounded-full border border-blueprintLine bg-white px-5 py-2.5 text-sm font-medium text-chalk transition-colors duration-200 hover:border-survey"
                >
                  Message us on WhatsApp
                </a>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-slateSoft">
                We typically reply within 1 business day.
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Footer — staff access lives here, quietly, not marketed as a homepage feature */}
      <footer className="bg-footerBg">
        <div className="h-1 bg-survey" />
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-[1.4fr_1fr_1fr]">
            {/* Brand */}
            <div>
              <div className="mb-3">
                <Logo height={32} theme="light" />
              </div>
              <p className="max-w-xs text-sm leading-relaxed text-footerTextSoft">
                Independent verification for property, builds, land and farms
                across Nigeria. We check what&apos;s real, before your money moves.
              </p>
            </div>

            {/* Explore */}
            <div>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-footerText">
                Explore
              </h3>
              <ul className="space-y-2.5 text-sm text-footerTextSoft">
                <li>
                  <a href="#what-we-do" className="transition-colors duration-200 hover:text-survey">
                    What we do
                  </a>
                </li>
                <li>
                  <a href="#testimonials" className="transition-colors duration-200 hover:text-survey">
                    Testimonials
                  </a>
                </li>
                <li>
                  <Link href="/signup" className="transition-colors duration-200 hover:text-survey">
                    Get started
                  </Link>
                </li>
                <li>
                  <Link
                    href="/login?role=client"
                    className="transition-colors duration-200 hover:text-survey"
                  >
                    Sign in
                  </Link>
                </li>
                <li>
                  {/* Placeholder path — no policies/FAQ page exists yet. Point
                      this at a real one before publishing. */}
                  <Link href="/policies" className="transition-colors duration-200 hover:text-survey">
                    Policies & FAQs
                  </Link>
                </li>
              </ul>
            </div>

            {/* Get in touch */}
            <div>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-footerText">
                Get in touch
              </h3>
              <ul className="space-y-2.5 text-sm text-footerTextSoft">
                <li className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-survey" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M4 6h16v12H4z" strokeWidth="1.6" strokeLinejoin="round" />
                    <path d="M4 7l8 6 8-6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <ContactEmail className="transition-colors duration-200 hover:text-survey" />
                </li>
                <li className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-survey" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                      d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"
                      strokeWidth="1.6"
                    />
                    <circle cx="12" cy="9.5" r="2.4" strokeWidth="1.6" />
                  </svg>
                  Nigeria, diaspora-served
                </li>
                <li className="flex items-center gap-2">
                  <a
                    href="https://wa.me/12816704862"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 transition-colors duration-200 hover:text-survey"
                  >
                    <svg className="h-4 w-4 text-survey" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path
                        d="M4 20l1.4-4.1A8 8 0 1 1 9 19.4L4 20z"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Message us on WhatsApp
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-4 border-t border-footerLine pt-6 text-xs text-footerTextSoft sm:flex-row sm:items-center sm:justify-between">
            <span>© 2026 iConfam. All rights reserved.</span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>Staff sign in:</span>
              {STAFF_ROLES.map((role, i) => (
                <span key={role.key} className="flex items-center gap-4">
                  <Link
                    href={`/login?role=${role.key}`}
                    className="transition-colors duration-200 hover:text-survey"
                  >
                    {role.label}
                  </Link>
                  {i < STAFF_ROLES.length - 1 && <span className="text-footerLine">·</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
