"use client";

import Link from "next/link";
import { Logo } from "./logo";
import { usePathname } from "next/navigation";

export const Header = () => {
  const pathname = usePathname();
  if (pathname !== "/") return null;
  return (
    <div className="fixed z-50 top-0 left-0 w-full pointer-events-none">
      <header className="flex items-center justify-between container pt-8 md:pt-14 pointer-events-auto">
        <Link href="/">
          <Logo className="w-[100px] md:w-[120px]" />
        </Link>
      </header>
    </div>
  );
};
