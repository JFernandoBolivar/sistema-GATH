"use client";

import { useEffect } from "react";

export default function MarqueeTitle({ text }: { text: string }) {
  useEffect(() => {
    const pad = "          ";
    const cycle = text + pad;
    const windowSize = text.length + pad.length;
    let pos = 0;

    const interval = setInterval(() => {
      let display = "";
      for (let i = 0; i < windowSize; i++) {
        display += cycle[(pos + i) % cycle.length];
      }
      document.title = display;
      pos = (pos + 1) % cycle.length;
    }, 200);

    return () => clearInterval(interval);
  }, [text]);

  return null;
}
