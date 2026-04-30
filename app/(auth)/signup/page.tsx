import Link from "next/link";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Créer le compte
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Premier accès uniquement — l&apos;inscription se verrouille après.
        </p>
      </div>
      <SignupForm />
      <p className="text-xs text-muted-foreground text-center">
        Déjà un compte ?{" "}
        <Link href="/login" className="underline underline-offset-4">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
