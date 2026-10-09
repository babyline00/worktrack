"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { BRAND, NasMark } from "./brand";

export function LoginScreen() {
  const router = useRouter();
  // Was pre-filled with the seed admin's address, so every visitor landed on a
  // form already holding a real login.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  async function authenticate(em: string, pw: string) {
    setLoading(true);
    const res = await signIn("credentials", {
      email: em,
      password: pw,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      toast.error("Invalid email or password");
      return;
    }
    toast.success("Welcome back!");
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await authenticate(email, password);
  }

  /**
   * Signs in straight away. This used to only populate the two inputs, so a
   * button labelled "Quick demo logins" did nothing visible until the visitor
   * also found and pressed "Sign in".
   */
  function quickLogin(em: string, pw: string) {
    setEmail(em);
    setPassword(pw);
    void authenticate(em, pw);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy via-[#1e293b] to-primary p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <NasMark className="h-16 w-16 drop-shadow-lg" />
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">
            {BRAND.name}
          </h1>
          <p className="mt-1 text-sm text-white/60">{BRAND.tagline}</p>
          <p className="mt-0.5 text-xs text-white/40">{BRAND.descriptor} Platform</p>
        </div>

        <div className="rounded-xl bg-card p-6 shadow-2xl">
          <h2 className="text-lg font-semibold text-navy">Sign in to your account</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your credentials to access the dashboard
          </p>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@worktrack.io"
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-navy"
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 size={14} className="mr-2 animate-spin" />}
              Sign in
            </Button>
          </form>

          <div className="mt-5 rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground">
              Quick demo logins
            </p>
            <div className="mt-2 space-y-1.5">
              <button
                onClick={() => quickLogin("admin@worktrack.io", "admin123")}
                className="block w-full rounded-md bg-card px-3 py-1.5 text-left text-xs hover:bg-muted"
              >
                <span className="font-semibold text-navy">Admin →</span>{" "}
                <span className="text-muted-foreground">
                  admin@worktrack.io / admin123
                </span>
              </button>
              <button
                onClick={() => quickLogin("ahmad.khan@worktrack.io", "employee123")}
                className="block w-full rounded-md bg-card px-3 py-1.5 text-left text-xs hover:bg-muted"
              >
                <span className="font-semibold text-navy">Employee →</span>{" "}
                <span className="text-muted-foreground">
                  ahmad.khan@worktrack.io / employee123
                </span>
              </button>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-white/40">
          © 2026 {BRAND.name}. All rights reserved.
        </p>
      </div>
    </div>
  );
}
