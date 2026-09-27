import "@/css/satoshi.css";
import "@/css/style.css";

import "flatpickr/dist/flatpickr.min.css";
import "jsvectormap/dist/jsvectormap.css";

import type { Metadata } from "next";
import NextTopLoader from "nextjs-toploader";
import type { PropsWithChildren } from "react";
import { Toaster } from "sonner";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    template: "%s | MOC Test",
    default: "PADA — Restaurant POS & Operations",
  },
  description: "Kasir restoran, inventaris, loyalti pelanggan, reservasi, dan dashboard operasional.",
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>
        <Providers>
          <NextTopLoader color="#5750F1" showSpinner={false} />

          {children}

          <Toaster
            position="bottom-right"
            richColors
            closeButton
            duration={5000}
            toastOptions={{
              className: "dark:bg-gray-dark dark:border-dark-3 dark:text-white",
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
