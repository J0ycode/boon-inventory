import { Logo } from "@/components/shared/logo";

/** Centered single-card layout for login, password reset, and (later) signup. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 pt-[max(2.5rem,env(safe-area-inset-top))] pb-10 md:justify-center">
      <Logo className="mb-6" />
      <main className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-card md:p-8">
        {children}
      </main>
    </div>
  );
}
