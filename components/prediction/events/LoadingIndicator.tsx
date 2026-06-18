import { Spinner } from "@/components/ui/spinner";

interface LoadingIndicatorProps {
  isVisible: boolean;
}

export function LoadingIndicator({ isVisible }: LoadingIndicatorProps) {
  if (!isVisible) return null;

  return (
    <div className="flex justify-center py-8">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        Loading more…
      </div>
    </div>
  );
}
