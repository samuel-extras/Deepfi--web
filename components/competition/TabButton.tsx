import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

export const TabButton = ({ active, onClick, children }: TabButtonProps) => {
  return (
    <Button
      onClick={onClick}
      variant="ghost"
      className={cn(
        "rounded-full border text-xs font-semibold px-3 py-1.5 h-8 transition-colors lg:hover:!bg-white lg:hover:!text-black lg:hover:!border-white",
        active
          ? "bg-white text-black border-white"
          : "bg-[#1A1D1F] text-[#838384] border-[#2D3134]"
      )}
    >
      {children}
    </Button>
  );
};
