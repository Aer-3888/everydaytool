"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type User = { email: string; name: string | null };

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/auth/me", { credentials: "same-origin" })
      .then(async (response) => response.ok ? response.json() as Promise<{ user: User }> : null)
      .then((body) => setUser(body?.user ?? null))
      .catch(() => setUser(null));
  }, []);

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST", credentials: "same-origin" });
    window.location.assign("/");
  }

  async function clearPlanner() {
    if (!window.confirm("Effacer tous les revenus, dépenses et réglages du budget ?")) return;
    const response = await fetch("/api/planner", { method: "DELETE", credentials: "same-origin" });
    setMessage(response.ok ? "Les données du budget ont été effacées." : "Impossible d'effacer les données.");
  }

  return (
    <main className="inner-page account-page">
      <header className="topbar"><Link className="wordmark" href="/">EDT<span>.</span></Link><nav aria-label="Navigation principale"><Link href="/">Outils</Link><a href="/budget">Budget</a></nav></header>
      <section className="account-content">
        <h1>Compte</h1>
        {user ? <>
          <dl className="account-details"><div><dt>Compte Google</dt><dd>{user.email}</dd></div><div><dt>Accès</dt><dd>Compte autorisé</dd></div></dl>
          <div className="account-actions"><button type="button" onClick={signOut}>Se déconnecter de ce navigateur</button><button className="danger-button" type="button" onClick={clearPlanner}>Effacer les données du budget</button></div>
          {message ? <p className="save-status" role="status">{message}</p> : null}
          <p className="account-note">La suppression du compte avec confirmation par e-mail sera disponible quand l&apos;envoi d&apos;e-mails sera relié à un domaine.</p>
        </> : <p>Connectez-vous depuis la page Budget pour afficher vos réglages.</p>}
      </section>
    </main>
  );
}
