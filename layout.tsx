import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Kazanç Dünyası",
  description: "Görevleri tamamla, puanlarını takip et.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="tr"><body>{children}</body></html>;
}
