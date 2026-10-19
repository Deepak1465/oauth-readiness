"use client";

import { useState } from "react";

export function CopyLink() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-quiet"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("Copy this link", window.location.href);
        }
      }}
    >
      <span aria-live="polite">{copied ? "Link copied" : "Copy link"}</span>
    </button>
  );
}
