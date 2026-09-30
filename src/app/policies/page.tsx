import Link from "next/link";
import Logo from "@/components/Logo";

const FAQS = [
  {
    q: "Do you guarantee the outcome of a verification?",
    a: "No. We report exactly what we find — good, bad, or unclear. A verification confirming an issue isn't a failure on our part; it's the entire point of paying for an independent check.",
  },
  {
    q: "What happens if you find a problem with my property, build, or farm?",
    a: "You get a plain-language report describing exactly what was found, before you send any further money. What you do with that information — proceed, renegotiate, or walk away — is entirely your decision.",
  },
  {
    q: "How do I know my money is safe?",
    a: "iConfam never buys, sells, builds, invests, or holds funds on your behalf, for any service. You pay us only for the verification report or milestone check itself — never for the property, build, or farm being verified, and never into any account we control on your behalf.",
  },
  {
    q: "How do you stop the person checking on my behalf from being bribed?",
    a: "Field agents and professionals are paid only by iConfam, never by the party being inspected. Site visits are unannounced rather than scheduled with the contractor, seller, or farm operator. We also avoid repeatedly pairing the same agent with the same contractor, seller, or relationship.",
  },
  {
    q: "How long do you keep my documents?",
    a: "In most cases, we don't need a copy of your documents at all — our licensed lawyer and surveyor network verifies directly against the government registry instead of asking you to upload anything. Where an upload genuinely can't be avoided, it's a photo or scan only, never the original, and it's automatically deleted 90 days after upload.",
  },
  {
    q: "Can I get a refund if I'm not satisfied?",
    a: "If we're unable to complete a verification you've paid for, you're refunded in full. Because the fee covers the work of checking — not a guaranteed result — a refund isn't offered simply because the finding wasn't the one you were hoping for.",
  },
  {
    q: "What if I need to cancel a request?",
    a: "Contact us before a field visit or professional review has started and we'll cancel with no charge. Once a visit or document check is underway, the fee covers the work already done.",
  },
  {
    q: "Who can sign up?",
    a: "Self-signup is for clients only — anyone with a property, build, or farm they want independently checked. Field agents, professionals, and admin accounts are invited directly and aren't available through public signup.",
  },
];

export default function PoliciesPage() {
  return (
    <div className="min-h-screen bg-blueprint font-body text-chalk">
      <header className="border-b border-blueprintLine">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link href="/">
            <Logo height={30} />
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-slateSoft transition-colors duration-200 hover:text-chalk"
          >
            ← Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-3xl font-semibold">Policies &amp; FAQs</h1>
        <p className="mt-3 max-w-xl text-base text-slateSoft">
          How iConfam works, what we do and don&apos;t do, and answers to the
          questions we hear most often.
        </p>

        <section className="mt-12">
          <h2 className="font-display text-xl font-semibold">What iConfam is — and isn&apos;t</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slateSoft">
            iConfam is an independent verification service. We check property,
            land, builds, and farms on your behalf, and report back exactly
            what we find. We are not a fund, a developer, a real estate agent,
            or a lender — we never buy, sell, build, or invest in anything we
            verify, and we never hold client funds at any point.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-xl font-semibold">Fees &amp; payment</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slateSoft">
            Every verification has a flat fee agreed before any work starts —
            never charged automatically. Fees cover the field visit,
            professional review, and written report; they are separate from,
            and unrelated to, any payment you make to a seller, developer,
            contractor, or farm operator.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-xl font-semibold">Data &amp; document retention</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slateSoft">
            Wherever possible, we verify directly against the government
            registry instead of asking for your documents. When an upload is
            genuinely unavoidable, we accept a photo or scan only — never the
            original — and it is automatically deleted 90 days after upload.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-xl font-semibold">Frequently asked questions</h2>
          <div className="mt-4 divide-y divide-blueprintLine">
            {FAQS.map((item) => (
              <details key={item.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-chalk">
                  {item.q}
                  <span className="ml-4 shrink-0 text-slateSoft transition-transform duration-200 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slateSoft">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <p className="mt-16 text-xs text-slateSoft">
          This page describes how iConfam is designed to operate. It is not a
          substitute for formal terms of service or a privacy policy reviewed
          by a lawyer — have both drafted properly before this page is relied
          on as a binding agreement with real clients.
        </p>
      </main>
    </div>
  );
}
