"use client";

import { useState } from "react";

type Side = "Pile" | "Face";

export default function CoinFlip() {
  const [side, setSide] = useState<Side>("Pile");
  const [isFlipping, setIsFlipping] = useState(false);

  function flip() {
    if (isFlipping) return;
    setIsFlipping(true);
    window.setTimeout(() => {
      const value = new Uint32Array(1);
      crypto.getRandomValues(value);
      setSide(value[0] % 2 === 0 ? "Pile" : "Face");
      setIsFlipping(false);
    }, 520);
  }

  return (
    <article className="tool-row coin-tool">
      <div className="tool-number">01</div>
      <div className="tool-summary">
        <h2>Pile ou face</h2>
        <p>Un lancer, rien n&apos;est enregistr&eacute;.</p>
      </div>
      <div className="coin-area">
        <output className={`coin ${isFlipping ? "is-flipping" : ""}`} aria-live="polite"><span>{side}</span></output>
        <button type="button" onClick={flip} disabled={isFlipping}>{isFlipping ? "Lancer" : "Lancer la pi\u00e8ce"}</button>
      </div>
    </article>
  );
}
