import Image from "next/image";

/**
 * A headshot the way a profile page shows one: a circle, with initials when
 * there is no photo. Sized in pixels because the two places it appears are
 * fixed — 40 on a card, 72 on the person page.
 */
export function Avatar({ name, src, size = 40 }: { name: string; src: string | null; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  const style: React.CSSProperties = {
    width: size, height: size, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
    border: "var(--border-1) solid var(--rule-strong)", background: "var(--canvas)",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
  };
  if (!src) {
    return (
      <span className="mono-label" style={{ ...style, color: "var(--ink-muted)", fontSize: Math.max(10, size * 0.32) }} aria-hidden>
        {initials}
      </span>
    );
  }
  return (
    <span style={style}>
      <Image src={src} alt="" width={size} height={size} style={{ width: size, height: size, objectFit: "cover", filter: "grayscale(0.15) contrast(1.05)" }} />
    </span>
  );
}
