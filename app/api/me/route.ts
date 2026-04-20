import { ok, requireUser } from "@/lib/api";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;
  return ok({ user });
}
