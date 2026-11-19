import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIVectorizer Studio — Advanced Vector Workspace",
  description:
    "A professional workspace for image enhancement, color reduction, vectorization and SVG editing.",
  applicationName: "AIVectorizer"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
