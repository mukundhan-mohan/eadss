"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminMe } from "@/lib/api";
import LogoMark from "@/components/LogoMark";

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
    if (typeof window !== "undefined" && localStorage.getItem("eadss_admin_logged_in") === "1") {
      setTryNowHref("/try-now");
    }
    (async () => {
      try {
        await adminMe();
        if (!cancelled) setTryNowHref("/try-now");
      } catch {
        if (!cancelled) {
          if (typeof window !== "undefined" && localStorage.getItem("eadss_admin_logged_in") === "1") {
            setTryNowHref("/try-now");
          } else {
            setTryNowHref("/login");
          }
        }
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
          <LogoMark size={30} />
          <span className="nav-brand-text">EADSS</span>
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
