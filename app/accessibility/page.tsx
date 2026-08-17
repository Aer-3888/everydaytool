import Link from "next/link";

export default function AccessibilityPage() {
  return <main className="legal-page"><Link className="wordmark" href="/">EDT<span>.</span></Link><h1>Accessibilité</h1><section><h2>État</h2><p>EDT est en cours d&apos;amélioration. Les pages utilisent des éléments HTML natifs, des libellés de formulaire et un contraste élevé.</p></section><section><h2>Nous signaler un problème</h2><p>Écrivez à <a href="mailto:theo.phan.quoc.huy@gmail.com">theo.phan.quoc.huy@gmail.com</a> avec la page concernée et ce qui bloque.</p></section><p className="legal-footer"><a href="/legal">Mentions légales</a> · <a href="/privacy">Confidentialité</a></p></main>;
}
