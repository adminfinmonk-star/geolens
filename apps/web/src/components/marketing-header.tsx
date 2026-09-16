"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GeoLensMark } from "./geolens-mark";

export function MarketingHeader() {
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`mk-header${solid ? " mk-header-solid" : ""}`}>
      <div className="mk-wrap mk-header-inner">
        <div className="mk-header-left">
          <Link href="/" className="mk-header-brand">
            <GeoLensMark className="mk-header-mark" />
            <span className="mk-header-brand-text">
              Geo<span>Lens</span>
            </span>
          </Link>
          <nav className="mk-nav-links" aria-label="Primary">
            <a href="#product">Product</a>
            <a href="#features">Features</a>
            <a href="#reviews">Resources</a>
            <Link href="/prj_demo/overview">Demo</Link>
          </nav>
        </div>
        <div className="mk-header-actions">
          <Link href="/login" className="mk-header-login">
            Log in
          </Link>
          <Link href="/signup" className="mk-btn-pill mk-btn-dark mk-header-cta">
            Book a demo
          </Link>
        </div>
      </div>
    </header>
  );
}
