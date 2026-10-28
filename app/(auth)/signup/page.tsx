import Link from "next/link";
import { SignupForm } from "@/components/auth/SignupForm";
import { ThemeToggle } from "@/components/common/ThemeToggle";

export default function SignupPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-background text-foreground">
      <div className="absolute top-4 right-4 sm:top-8 sm:right-8">
        <ThemeToggle />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-lg text-center px-4">
        <Link href="/" className="inline-flex items-center gap-2 mb-4 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-white font-heading font-black text-xl shadow-md group-hover:scale-105 transition-transform">
            Á
          </div>
          <span className="font-heading font-extrabold text-2xl tracking-tight text-foreground">
            Ártemis
          </span>
        </Link>
        <h2 className="font-heading font-bold text-2xl tracking-tight text-foreground">
          Crie seu perfil acadêmico
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecte-se a laboratórios, bolsas e pesquisadoras de todo o país
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl px-4">
        <div className="bg-card py-8 px-6 shadow-sm border border-border rounded-2xl sm:px-10">
          <SignupForm />
        </div>
      </div>
    </div>
  );
}
