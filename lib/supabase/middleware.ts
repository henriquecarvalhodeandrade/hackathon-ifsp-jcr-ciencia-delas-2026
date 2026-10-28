import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/types/database";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

interface CookieToSet {
  name: string;
  value: string;
  options?: Parameters<typeof supabaseResponse.cookies.set>[2];
}

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Não lance exceções em builds ou rotas se as chaves forem provisórias
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;
    const isAuthPage =
      pathname.startsWith("/login") || pathname.startsWith("/signup");
    const isPublicPage =
      pathname === "/" ||
      pathname.startsWith("/vitrine") ||
      pathname.startsWith("/conduta") ||
      pathname.startsWith("/auth");

    // Se não estiver logado e tentar acessar área logada, redireciona para login
    if (!user && !isAuthPage && !isPublicPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    // Se já estiver logado e tentar acessar login/signup, vai pro feed
    if (user && isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/feed";
      return NextResponse.redirect(url);
    }
  } catch {
    // Falha silenciosa de auth se credenciais ainda forem provisórias
  }

  return supabaseResponse;
}
