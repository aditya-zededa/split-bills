import { SignUpForm } from "./signup-form";

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold">Create account</h1>
          <p className="text-sm text-muted-foreground">
            Sign up with email and password.
          </p>
        </div>
        <SignUpForm />
      </div>
    </main>
  );
}
