import type { Metadata } from "next";
import Link from "next/link";
import ContactEmail from "@/components/ContactEmail";
import Logo from "@/components/Logo";

export const metadata: Metadata = {
  title: "Policies, privacy and terms",
  description: "How iConfam works, what we do and don't do, how we handle your data, and our terms of use.",
};

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
        <h1 className="font-display text-3xl font-semibold">Policies, privacy &amp; FAQs</h1>
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

        <section id="privacy" className="mt-12 scroll-mt-24">
          <h2 className="font-display text-xl font-semibold">Privacy</h2>
          <div className="mt-3 max-w-2xl space-y-3 text-sm leading-relaxed text-slateSoft">
            <p>
              <span className="font-medium text-chalk">What we collect.</span> The details you give us when you
              request a verification or create an account: your name, email, phone or WhatsApp number, and what
              you want checked. During a verification our team may add site photos, videos and the GPS position
              of the visit, written findings, and, only when unavoidable, a photo or scan of a document.
            </p>
            <p>
              <span className="font-medium text-chalk">Who can see it.</span> You, the iConfam admin team, and
              only the field agent and professionals assigned to your case. Nothing a team member submits reaches
              you until an admin has reviewed it. Clients never see each other&apos;s cases.
            </p>
            <p>
              <span className="font-medium text-chalk">Advertising cookies.</span> If you allow them, Meta and
              Google cookies tell us which ads brought a visitor to this website, so we can see what works.
              They run only on the public pages, never inside your signed-in area, and never see your documents
              or case details. If you choose &ldquo;No thanks&rdquo;, they are not loaded.
            </p>
            <p>
              <span className="font-medium text-chalk">Services that process your data for us.</span> Our hosting,
              database, email and, where you pay by card, payment providers. We do not sell your data.
            </p>
            <p>
              <span className="font-medium text-chalk">Your choices.</span> Ask us to see, correct or delete your
              information by emailing <ContactEmail className="font-medium text-survey hover:underline" />.
              Uploaded documents are deleted automatically 90 days after upload.
            </p>
          </div>
        </section>

        <section id="terms" className="mt-10 scroll-mt-24">
          <h2 className="font-display text-xl font-semibold">Terms of use</h2>
          <div className="mt-3 max-w-2xl space-y-3 text-sm leading-relaxed text-slateSoft">
            <p>
              <span className="font-medium text-chalk">What you are buying.</span> An independent check and a
              written report. iConfam does not guarantee a particular result, and the report is not legal,
              financial or investment advice. The decision to buy, build, pay or walk away is always yours.
            </p>
            <p>
              <span className="font-medium text-chalk">What we need from you.</span> Accurate information about
              the property, build or farm, and the access or contacts our team needs to do the check.
            </p>
            <p>
              <span className="font-medium text-chalk">Fees and refunds.</span> As described above: a fee agreed
              with you before work starts, a full refund if we cannot complete a check you have paid for, and no
              refund simply because the finding was not the one you hoped for.
            </p>
            <p>
              <span className="font-medium text-chalk">Limits.</span> We check what can be verified from official
              records and the site at the time of the visit. Conditions can change after our report, and a check
              cannot rule out every risk.
            </p>
          </div>
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
          These are plain-language summaries of how iConfam operates. Last updated October 2026.
        </p>
      </main>
    </div>
  );
}
