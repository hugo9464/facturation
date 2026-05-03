export default function TodoLoading() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <div className="h-7 w-28 rounded-md bg-muted" />
        <div className="mt-2 h-4 w-48 rounded-md bg-muted" />
      </div>
      <div className="rounded-md border p-4">
        <div className="h-8 w-full rounded-md bg-muted" />
        <div className="mt-3 h-8 w-full rounded-md bg-muted" />
        <div className="mt-3 h-8 w-2/3 rounded-md bg-muted" />
      </div>
    </div>
  );
}
