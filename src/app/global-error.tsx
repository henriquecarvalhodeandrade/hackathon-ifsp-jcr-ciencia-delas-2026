"use client";

import { useEffect } from "react";
import { THEME_STORAGE_KEY } from "@/components/layout/theme";
import "./globals.css";

/**
 * Erro no layout raiz: substitui o documento inteiro, então não usa fontes do next/font
 * nem o cabeçalho. Mantém as cores da marca e o tema escolhido.
 * Este documento é renderizado no cliente: um <script> inline aqui nunca executaria (e o React
 * avisa no console), então o tema salvo é reaplicado num efeito. Sem preferência salva, o
 * `color-scheme: light dark` do :root segue o sistema.
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  useEffect(() => {
    try {
      const preference = localStorage.getItem(THEME_STORAGE_KEY);
      if (preference === "light" || preference === "dark") document.documentElement.dataset.theme = preference;
    } catch {
      // armazenamento bloqueado: segue o tema do sistema
    }
  }, []);

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <title>Algo saiu da órbita · Ciência Delas</title>
      </head>
      <body className="flex min-h-dvh items-center justify-center bg-bg p-6 font-sans text-fg">
        <main className="max-w-md text-center">
          <p className="eyebrow text-primary">Ciência Delas</p>
          <h1 className="mt-3 text-3xl font-bold">Algo saiu da órbita</h1>
          <p className="mt-3 text-fg-muted">
            O site encontrou um erro inesperado. Tente recarregar — se persistir, volte em alguns minutos.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => retry()}
              className="inline-flex h-11 items-center rounded-control bg-primary px-5 font-semibold text-primary-fg hover:bg-primary-hover"
            >
              Tentar de novo
            </button>
            {/* <a> de propósito: o layout raiz quebrou, então recarregar a página inteira é o caminho seguro. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="inline-flex h-11 items-center rounded-control border border-border-strong px-5 font-semibold text-fg hover:bg-surface-2"
            >
              Ir para o início
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
