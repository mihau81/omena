export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-2">
          <div className="h-3 w-3 animate-pulse rounded-full bg-beige" />
          <div className="h-3 w-3 animate-pulse rounded-full bg-beige [animation-delay:150ms]" />
          <div className="h-3 w-3 animate-pulse rounded-full bg-beige [animation-delay:300ms]" />
        </div>
        <p className="text-sm text-taupe">Ładowanie...</p>
      </div>
    </div>
  );
}
