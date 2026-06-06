import "./styles.css";

export const metadata = {
  title: "World Cup Arena Agent",
  description: "Polymarket World Cup agent run console",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
