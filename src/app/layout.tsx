import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Turnia — Turnos online para tu negocio",
    template: "%s · Turnia",
  },
  description:
    "Página de reservas, calendario configurable y confirmaciones automáticas para comerciantes y profesionales que hoy manejan turnos por WhatsApp.",
  applicationName: "Turnia",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
