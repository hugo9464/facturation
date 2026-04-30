export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center px-4 py-12 bg-muted/30">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
