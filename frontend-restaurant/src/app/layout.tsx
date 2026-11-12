import type { Metadata } from "next";
import NextTopLoader from "nextjs-toploader";
import type { PropsWithChildren } from "react";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    template: "%s | MOC Test",
    default: "PADA — Restaurant POS & Operations",
  },
  description:
    "Kasir restoran, inventaris, loyalti pelanggan, reservasi, dan dashboard operasional.",
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="id">
      <body style={{ margin: 0, padding: 0, background: "#f0f2f5" }}>
        <Providers>
          <NextTopLoader color="#1677ff" showSpinner={false} />
          {children}
        </Providers>
      </body>
    </html>
  );
}
