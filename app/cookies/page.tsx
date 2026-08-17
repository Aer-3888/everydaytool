import Link from "next/link";

export default function CookiesPage() {
  return <main className="legal-page"><Link className="wordmark" href="/">EDT<span>.</span></Link><h1>Cookies</h1><section><h2>Cookies nécessaires</h2><p>EDT utilise un cookie de session après connexion et un cookie temporaire pendant la connexion Google. Ils servent à sécuriser l&apos;accès au budget.</p></section><section><h2>Mesure d&apos;audience</h2><p>EDT n&apos;utilise pas de cookie publicitaire ni de mesure d&apos;audience dans cette première version.</p></section><p className="legal-footer"><a href="/privacy">Confidentialité</a> · <a href="/legal">Mentions légales</a></p></main>;
}
