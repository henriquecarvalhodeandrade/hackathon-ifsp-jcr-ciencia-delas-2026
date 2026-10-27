// Gera os cookies de sessão do Supabase (formato do @supabase/ssr) para uma conta,
// para usar em testes E2E com Playwright sem passar pela tela de login.
//
// Uso (Supabase local rodando + seed):
//   node scripts/e2e/auth-cookies.mjs yasmin@demo.cienciadelas.dev [senha] > /tmp/cookies.json
// No Playwright:
//   await context.addCookies(JSON.parse(fs.readFileSync('/tmp/cookies.json', 'utf8')))
// Lê NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY do .env.local.
import { createServerClient } from "@supabase/ssr";

try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local: usa o ambiente atual
}

const [email, password = "ciencia-delas-demo", baseUrl = "http://localhost:3000"] = process.argv.slice(2);
if (!email) {
  console.error("Uso: node scripts/e2e/auth-cookies.mjs <email> [senha] [baseUrl]");
  process.exit(1);
}

const jar = new Map();
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  },
);

const { error } = await supabase.auth.signInWithPassword({ email, password });
if (error) {
  console.error(`Falha no login de ${email}: ${error.message}`);
  process.exit(1);
}

const { hostname } = new URL(baseUrl);
const cookies = [...jar.entries()].map(([name, value]) => ({
  name,
  value,
  domain: hostname,
  path: "/",
  httpOnly: false,
  secure: false,
  sameSite: "Lax",
}));
process.stdout.write(JSON.stringify(cookies, null, 2) + "\n");
