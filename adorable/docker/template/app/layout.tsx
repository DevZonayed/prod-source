import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Voxel App",
  description: "Built with Voxel",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
