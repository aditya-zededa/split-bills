import { SignInForm } from "./signin-form";

export default function SignInPage({
  searchParams
}: {
  searchParams?: { callbackUrl?: string; error?: string };
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            Use your email and password.
          </p>
        </div>
        <SignInForm
          callbackUrl={searchParams?.callbackUrl ?? "/groups"}
          errorFromUrl={searchParams?.error}
        />
      </div>
    </main>
  );
}
