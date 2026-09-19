import { Nav } from "@/components/tb/chrome";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="tb-page" style={{ minHeight: "100vh" }}>
      <Nav cta={null} />
      <section className="tb-band tb-layer" style={{ flexGrow: 1 }}>
        <div className="tb-wrap" style={{ maxWidth: 460 }}>{children}</div>
      </section>
    </div>
  );
}
