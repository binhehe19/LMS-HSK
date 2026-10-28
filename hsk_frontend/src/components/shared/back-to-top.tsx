"use client";

import { useEffect, useState } from "react";

// Port của LMS_Frontend/src/core/common/back-to-top/back-to-top.tsx (cùng DOM/class; <Link to="#">
// của react-router đổi thành <a href="#"> + preventDefault để không đổi URL, như bản cũ).
export function BackToTop() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 500);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="back-to-top">
      <a
        className={`back-to-top-icon align-items-center justify-content-center d-flex ${scrolled ? "show" : ""}`}
        href="#"
        onClick={scrollToTop}
      >
        <i className="fa-solid fa-arrow-up" />
      </a>
    </div>
  );
}
