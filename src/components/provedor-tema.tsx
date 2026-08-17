"use client";

import { ThemeProvider } from "next-themes";

/**
 * Tema claro/escuro. Segue o do sistema por padrão — se o celular dela está
 * no modo escuro, o app abre escuro.
 */
export function ProvedorTema({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
