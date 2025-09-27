"use client";

import Link from "next/link";
import { GL } from "./gl";
import { Pill } from "./pill";
import { Button } from "./ui/button";
import { useState } from "react";

export function Hero() {
  const [hovering, setHovering] = useState(false);
  return (
    <div className="flex flex-col h-svh justify-between">
      <GL hovering={hovering} />

      <div className="pb-16 mt-auto text-center relative">
        <Pill className="mb-6">State of the Art</Pill>
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-sentient">
          TensorNode
        </h1>
        <p className="font-mono text-sm sm:text-base text-foreground/60 text-balance mt-8 max-w-[440px] mx-auto">
          A Proof of Inteligence Network
        </p>
        <p className="font-mono text-xs sm:text-xs text-foreground/60 text-balance mt-8 max-w-[440px] mx-auto">
          Powered by Hedera
        </p>
        <div className="flex justify-center gap-6">
        <Link className="contents max-sm:hidden" href="/subnet">
          <Button
            className="mt-14"
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
          >
            [Subnet]
          </Button>
        </Link>
        <Link className="contents max-sm:hidden" href="/validator">
          <Button
            className="mt-14"
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
          >
            [Validator]
          </Button>
        </Link><Link className="contents max-sm:hidden" href="/miner">
          <Button
            className="mt-14"
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
          >
              [Miner]
          </Button>
        </Link>
        </div>
      </div>
    </div>
  );
}
