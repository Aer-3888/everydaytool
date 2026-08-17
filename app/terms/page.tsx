import Link from "next/link";

export default function TermsPage() {
  return <main className="legal-page"><Link className="wordmark" href="/">EDT<span>.</span></Link><h1>Conditions d&apos;utilisation</h1><section><h2>Service personnel</h2><p>EDT est un outil personnel de calcul et de planification. Il ne fournit pas de conseil financier, bancaire ou juridique.</p></section><section><h2>Vos données</h2><p>Vous restez responsable des montants et des dates que vous saisissez. Vérifiez les résultats avant toute décision.</p></section><section><h2>Accès</h2><p>L&apos;accès au budget est limité au compte Google autorisé. EDT peut évoluer ou être interrompu sans garantie de disponibilité.</p></section><p className="legal-footer"><a href="/legal">Mentions légales</a> · <a href="/privacy">Confidentialité</a></p></main>;
}
