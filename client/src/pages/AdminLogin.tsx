import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();

  const loginMutation = trpc.admin.login.useMutation({
    onSuccess: (data: any) => {
      if (data.success) {
        localStorage.setItem("adminToken", "true");
        toast.success("Login successful!");
        setLocation("/admin");
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Login failed");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ username, password });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="border border-border rounded-lg p-8 bg-card">
          <h1 className="text-3xl font-bold text-foreground mb-2">SE Tiers</h1>
          <p className="text-muted-foreground mb-8">Admin Dashboard</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Username
              </label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                disabled={isLoading}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                disabled={isLoading}
                className="w-full"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loginMutation.isPending || !username || !password}
            >
              {loginMutation.isPending ? "Logging in..." : "Login"}
            </Button>
          </form>

          <div className="mt-8 pt-8 border-t border-border">
            <p className="text-muted-foreground text-xs text-center">
              Only administrators can access this page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
