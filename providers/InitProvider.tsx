"use client";

import dynamic from "next/dynamic";

const InitEffects = dynamic(() => import("./InitProviderEffects"), {
  ssr: false,
});

export function InitProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <InitEffects />
    </>
  );
}
