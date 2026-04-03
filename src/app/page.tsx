"use client";

import dynamic from "next/dynamic";

const Analyzer = dynamic(() => import("@/components/analyzer"), { ssr: false });

export default function Home() {
  return <Analyzer />;
}
