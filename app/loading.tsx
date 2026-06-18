export default function GlobalLoading() {
  return (
    <div className="min-h-[calc(100vh-3rem)] flex items-center justify-center bg-background">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary"
          aria-hidden
        />
        <span>Loading…</span>
      </div>
    </div>
  );
}
