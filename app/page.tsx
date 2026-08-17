import CoinFlip from "./coin-flip";
import { Flower2 } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <main className="site-shell">
      <header className="topbar">
        <Link className="wordmark mark-icon" href="/" aria-label="Accueil">
          <Flower2 aria-hidden="true" strokeWidth={1.75} />
        </Link>
        <nav aria-label="Navigation principale">
          <a href="#outils">Outils</a>
          <a href="/budget">Budget</a>
          <a href="/account">Compte</a>
        </nav>
        <span className="language" lang="fr">FR</span>
      </header>

      <section className="home-masthead" aria-label="Illustration">
        <Flower2 aria-hidden="true" strokeWidth={1.35} />
      </section>

      <section className="tool-list" id="outils" aria-label="Outils disponibles">
        <CoinFlip />
        <article className="tool-row locked-tool">
          <div className="tool-number">02</div>
          <div className="tool-summary">
            <h2>Budget</h2>
            <p>Suivez vos revenus, &eacute;ch&eacute;ances et paiements. Votre espace reste priv&eacute;.</p>
          </div>
          <a className="arrow-link" href="/budget" aria-label="Ouvrir le budget">Ouvrir le budget</a>
        </article>
      </section>

      <footer id="footer">
        <span>EDT, un outil personnel par Theo Phan.</span>
        <span><a href="/legal">Mentions l&eacute;gales</a> · <a href="/privacy">Confidentialit&eacute;</a></span>
      </footer>
    </main>
  );
}
