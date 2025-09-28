'use client'

import { Hero } from "@/components/hero";
import { Leva } from "leva";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function Home() {
  return (
    <>
      <Hero />
      <section className="container mx-auto px-4 pb-16">
        <div className="mt-8 sm:mt-16 rounded-2xl border bg-background/60 backdrop-blur-sm ring-1 ring-border shadow-[0_8px_24px_rgba(0,0,0,0.15)] [box-shadow:inset_0_1px_0_rgba(255,255,255,0.06)]">
          <div className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="font-medium">Get started</div>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="transition-shadow hover:shadow-lg">
                <CardHeader>
                  <CardTitle>Subnet</CardTitle>
                  <CardDescription>Manage nodes and view VM instances.</CardDescription>
                  <Link href="/subnet" className="mt-2">
                    <Button size="sm">Open Subnet</Button>
                  </Link>
                </CardHeader>
              </Card>
              <Card className="transition-shadow hover:shadow-lg">
                <CardHeader>
                  <CardTitle>Validator</CardTitle>
                  <CardDescription>Send queries and score miner answers.</CardDescription>
                  <Link href="/validator" className="mt-2">
                    <Button size="sm">Open Validator</Button>
                  </Link>
                </CardHeader>
              </Card>
              <Card className="transition-shadow hover:shadow-lg">
                <CardHeader>
                  <CardTitle>Miner</CardTitle>
                  <CardDescription>Create VMs and deploy your Docker app.</CardDescription>
                  <Link href="/miner" className="mt-2">
                    <Button size="sm">Open Miner</Button>
                  </Link>
                </CardHeader>
              </Card>
            </div>
          </div>
        </div>
      </section>
      <Leva hidden />
    </>
  );
}
