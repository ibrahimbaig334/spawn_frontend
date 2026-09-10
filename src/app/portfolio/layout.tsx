import { PortfolioNav } from "@/components/portfolio/portfolio-nav";

export default function PortfolioLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <PortfolioNav />
      {children}
    </>
  );
}
