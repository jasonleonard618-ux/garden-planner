import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Garden Planner · Map your site",
  description: "Map your yard from above: measure a garden spot and see its sun, shade, slope, wind, climate zone and soil.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#2f4a3a" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
