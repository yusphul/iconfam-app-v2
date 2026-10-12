import RoleGateway from "@/components/RoleGateway";
import HomeRedirect from "@/components/HomeRedirect";

// The public home page is rendered on the server, so visitors (and search engines
// and ad reviewers) get the full page straight away instead of a "Loading…" screen
// while sign-in is checked. Signed-in people are sent to their workspace by
// <HomeRedirect />, which renders nothing for everyone else.
export default function Home() {
  return (
    <>
      <HomeRedirect />
      <RoleGateway />
    </>
  );
}
