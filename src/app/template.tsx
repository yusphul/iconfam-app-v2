// Unlike layout.tsx (which persists across navigation), template.tsx creates a
// fresh instance on every route change — that's what makes the CSS animation
// on page-fade-in actually re-trigger each time, giving every navigation a
// quick fade + rise instead of an abrupt cut. No client-side JS needed: the
// animation runs purely from the class re-mounting into the DOM.
export default function RootTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-fade-in">{children}</div>;
}
