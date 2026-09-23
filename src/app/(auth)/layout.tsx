export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <p className="font-display mb-10 text-center text-lg text-ink-2">HungryTales</p>
      {children}
    </main>
  );
}
