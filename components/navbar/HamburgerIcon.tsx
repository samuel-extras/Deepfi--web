"use client";

import * as React from "react";
import { HarmburgerMenuIcon } from "../icons";

type HamburgerIconProps = {
  isOpen: boolean;
  onClick: () => void;
};

export const HamburgerIcon = ({ isOpen, onClick }: HamburgerIconProps) => {
  return (
    <button
      type="button"
      aria-label="Open menu"
      onClick={onClick}
      className="lg:hidden focus:outline-none"
    >
      <HarmburgerMenuIcon />
    </button>
  );
};

export const _HamburgerIcon = ({ isOpen, onClick }: HamburgerIconProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isOpen ? "Close menu" : "Open menu"}
      className="lg:hidden relative h-6 w-6 focus:outline-none"
    >
      <span className="sr-only">{isOpen ? "Close menu" : "Open menu"}</span>
      <div className="absolute left-1/2 top-1/2 block w-5 -translate-x-1/2 -translate-y-1/2">
        <span
          className={`absolute block h-0.5 w-5 transform bg-white transition-all duration-300 ease-in-out ${
            isOpen ? "rotate-45 translate-y-0" : "-translate-y-1.5"
          }`}
        />
        <span
          className={`absolute block h-0.5 w-5 transform bg-white transition-all duration-200 ease-in-out ${
            isOpen ? "opacity-0" : "opacity-100"
          }`}
        />
        <span
          className={`absolute block h-0.5 w-5 transform bg-white transition-all duration-300 ease-in-out ${
            isOpen ? "-rotate-45 translate-y-0" : "translate-y-1.5"
          }`}
        />
      </div>
    </button>
  );
};
