import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Connexion</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connecte-toi pour accéder à ta facturation.
        </p>
      </div>
      <LoginForm />
      <p className="text-xs text-muted-foreground text-center">
        Pas encore de compte ?{" "}
        <Link href="/signup" className="underline underline-offset-4">
          Créer le compte
        </Link>
      </p>
    </div>
  );
}
