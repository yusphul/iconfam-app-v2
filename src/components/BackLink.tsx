import Link from "next/link";

export default function BackLink({
  href,
  children,
  tone = "default",
}: {
  href: string;
  children: React.ReactNode;
  /** "light" is for sitting on top of a dark photo. */
  tone?: "default" | "light";
}) {
  const colour =
    tone === "light"
      ? "text-white/85 hover:text-white"
      : "text-neutral-500 hover:text-stamp";
  return (
    <Link
      href={href}
      className={`mb-4 inline-flex items-center gap-1.5 rounded-full text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stamp ${colour}`}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {children}
    </Link>
  );
}
