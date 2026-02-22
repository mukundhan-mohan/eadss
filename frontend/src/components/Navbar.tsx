"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminMe } from "@/lib/api";

const baseItems = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/alerts", label: "Alerts" },
  { href: "/api-docs", label: "API Docs" },
];

export default function Navbar() {
  const [tryNowHref, setTryNowHref] = useState("/login");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await adminMe();
        if (!cancelled) setTryNowHref("/try-now");
      } catch {
        if (!cancelled) setTryNowHref("/login");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <header className="nav-shell">
      <div className="nav-wrap">
        <Link href="/" className="nav-brand">
          <span className="nav-dot" />
          <span>EADSS</span>
        </Link>
        <nav className="nav-links" aria-label="Primary">
          {baseItems.map((item) => (
            <Link key={item.href} href={item.href} className="nav-link">
              {item.label}
            </Link>
          ))}
          <Link href={tryNowHref} className="nav-link">
            Try Now
          </Link>
        </nav>
      </div>
    </header>
  );
}
