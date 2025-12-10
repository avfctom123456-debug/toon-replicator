import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import gtoonsLogo from "@/assets/gtoons-logo.svg";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { z } from "zod";
import { Gamepad2, Sparkles, KeyRound, ArrowLeft } from "lucide-react";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

type AuthMode = "login" | "signup" | "forgot";

const Auth = () => {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  const isLogin = authMode === "login";
  const isForgot = authMode === "forgot";

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        navigate("/home", { state: { username: "Player" } });
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate("/home", { state: { username: "Player" } });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const validateInputs = () => {
    try {
      emailSchema.parse(email);
    } catch {
      toast.error("Please enter a valid email address");
      return false;
    }

    try {
      passwordSchema.parse(password);
    } catch {
      toast.error("Password must be at least 6 characters");
      return false;
    }

    if (authMode === "signup" && !username.trim()) {
      toast.error("Please enter a username");
      return false;
    }

    return true;
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      emailSchema.parse(email);
    } catch {
      toast.error("Please enter a valid email address");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      
      if (error) throw error;
      
      toast.success("Password reset link sent! Check your email.");
      setAuthMode("login");
    } catch (error: any) {
      console.error("Reset password error:", error);
      toast.error(error.message || "Failed to send reset link");
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isForgot) {
      return handleForgotPassword(e);
    }
    
    if (!validateInputs()) return;
    
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Welcome back!");
      } else {
        const redirectUrl = `${window.location.origin}/`;
        
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
          },
        });
        
        if (error) {
          if (error.message.includes("already registered")) {
            toast.error("This email is already registered. Please sign in.");
            setAuthMode("login");
            return;
          }
          throw error;
        }

        if (data.user) {
          const { error: profileError } = await supabase.from("profiles").insert({
            user_id: data.user.id,
            username: username.trim(),
          });
          
          if (profileError) {
            console.error("Profile creation error:", profileError);
          }
          
          toast.success("Account created! Welcome to gTOONS!");
        }
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      toast.error(error.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10 flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-60 h-60 bg-accent/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <img 
            src={gtoonsLogo} 
            alt="gTOONS Remastered" 
            className="w-64 md:w-80 h-auto drop-shadow-2xl"
          />
        </div>

        {/* Auth Card */}
        <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-6">
            {isForgot && (
              <button
                type="button"
                onClick={() => setAuthMode("login")}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
              </button>
            )}
            <div className="inline-flex items-center justify-center gap-2 mb-2">
              {isForgot ? (
                <KeyRound className="w-6 h-6 text-accent" />
              ) : isLogin ? (
                <Gamepad2 className="w-6 h-6 text-primary" />
              ) : (
                <Sparkles className="w-6 h-6 text-accent" />
              )}
              <h2 className="text-2xl font-bold text-foreground">
                {isForgot ? "Reset Password" : isLogin ? "Welcome Back" : "Join the Game"}
              </h2>
            </div>
            <p className="text-muted-foreground text-sm">
              {isForgot 
                ? "Enter your email and we'll send you a reset link" 
                : isLogin 
                  ? "Sign in to continue your adventure" 
                  : "Create your account to start playing"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleAuth} className="flex flex-col gap-4">
            {authMode === "signup" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">Username</label>
                <Input
                  type="text"
                  placeholder="Choose a username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required={authMode === "signup"}
                  className="bg-background/50 border-border/50 focus:border-primary transition-colors"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/80">Email</label>
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background/50 border-border/50 focus:border-primary transition-colors"
              />
            </div>

            {!isForgot && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">Password</label>
                <Input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-background/50 border-border/50 focus:border-primary transition-colors"
                />
              </div>
            )}

            {isLogin && !isForgot && (
              <button
                type="button"
                onClick={() => setAuthMode("forgot")}
                className="text-sm text-muted-foreground hover:text-primary transition-colors text-right"
              >
                Forgot password?
              </button>
            )}

            <Button 
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-6 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Loading...
                </span>
              ) : isForgot ? (
                "Send Reset Link"
              ) : isLogin ? (
                "Sign In"
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          {/* Toggle */}
          {!isForgot && (
            <div className="mt-6 pt-6 border-t border-border/30 text-center">
              <button
                type="button"
                onClick={() => setAuthMode(isLogin ? "signup" : "login")}
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                {isLogin ? (
                  <>Don't have an account? <span className="text-primary font-medium">Sign up</span></>
                ) : (
                  <>Already have an account? <span className="text-primary font-medium">Sign in</span></>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Features hint */}
        <div className="mt-6 flex justify-center gap-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            Collect Cards
          </span>
          <span className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-accent" />
            Battle Players
          </span>
          <span className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
            Trade & Win
          </span>
        </div>
      </div>

      {/* Version */}
      <div className="fixed bottom-4 left-4 text-muted-foreground/50 text-xs">
        v0.0.39
      </div>
    </div>
  );
};

export default Auth;
