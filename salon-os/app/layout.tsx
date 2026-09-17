import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Salon OS",
  description: "Booking, CRM, payments, funnels and content on one spine.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
