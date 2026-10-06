import BlacklistSection from "../blacklist/BlacklistPage";
import IgnoredIpsSection from "./IgnoredIpsSection";

/**
 * Settings page: excluded senders and ignored IP addresses.
 */
export default function SettingsPage() {
  return (
    <section className="stack">
      <h2>Settings</h2>

      <BlacklistSection />

      <IgnoredIpsSection />
    </section>
  );
}
