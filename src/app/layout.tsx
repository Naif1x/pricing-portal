import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trustangle Pricing Portal",
  description: "Sales pricing and quote generation tool",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface">{children}</body>
    </html>
  );
}
