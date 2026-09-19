import Image from "next/image";
import { companyInfo, monogram } from "@/lib/companies";

/**
 * A company's mark in a square tile, with a monogram when we have no logo.
 *
 * The tile is white whatever the theme: favicons are drawn for a white ground
 * and several of them are dark marks on transparency, which vanish on the
 * paper canvas. Sizes are fixed per placement, like Avatar — 40 on a card, 56
 * on a company page.
 */
export function CompanyLogo({ name, size = 40 }: { name: string; size?: number }) {
  const info = companyInfo(name);
  const style: React.CSSProperties = {
    width: size, height: size, flexShrink: 0, overflow: "hidden",
    border: "var(--border-1) solid var(--rule-strong)", background: "#fff",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
  };
  if (!info.logo) {
    return (
      <span className="mono-label" aria-hidden
        style={{ ...style, color: "#111", fontSize: Math.max(10, Math.round(size * 0.34)) }}>
        {monogram(info.name)}
      </span>
    );
  }
  const inner = Math.round(size * 0.68);
  return (
    <span style={style}>
      <Image src={info.logo} alt="" width={inner} height={inner} unoptimized
        style={{ width: inner, height: inner, objectFit: "contain" }} />
    </span>
  );
}
