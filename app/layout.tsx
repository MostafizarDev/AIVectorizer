import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIVectorizer — Professional Image to Vector",
  description:
    "Convert raster images into editable SVG artwork with browser-first vectorization tools.",
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
