import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UserData, UserRole, getDivision, isValidUser } from "@/lib/constants";
import { Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: UserData | null;
  login: (id: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserData>) => Promise<void>;
  isLoggedIn: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

function studentIdToEmail(studentId: string): string {
  return `${studentId.toLowerCase()}@students.notesfriendly.app`;
}

function padPassword(password: string): string {
  return password + "_nf2026!";
}

async function fetchUserData(userId: string): Promise<UserData | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) return null;

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  let role: UserRole = "student";
  if (roles?.some((r: any) => r.role === "god")) role = "god";
  else if (roles?.some((r: any) => r.role === "admin")) role = "admin";

  return {
    id: profile.student_id,
    division: profile.division as "CS" | "BS" | "IT",
    role,
    name: profile.name,
    regNo: profile.reg_no,
    avatarUrl: profile.avatar_url || undefined,
    bio: (profile as any).bio || undefined,
    supabaseId: userId,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // IMPORTANT: getSession must be set up BEFORE onAuthStateChange
    // and we must NOT await inside onAuthStateChange to avoid deadlocks
    let isMounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      if (session?.user) {
        const userData = await fetchUserData(session.user.id);
        if (isMounted) setUser(userData);
      }
      if (isMounted) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setLoading(false);
          return;
        }
        if (session?.user) {
          // Log login activity (fire-and-forget)
          if (event === 'SIGNED_IN') {
            supabase.from("activity_logs").insert({
              user_id: session.user.id,
              action: "login",
              details: null,
              page: "/login",
            }).then(() => {});
          }
          // Fire and forget — don't block the callback
          fetchUserData(session.user.id).then((userData) => {
            if (isMounted) {
              setUser(userData);
              setLoading(false);
            }
          });
        } else {
          setUser(null);
          setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (id: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const normalizedId = id === "god" ? "god" : id.toUpperCase();

    if (normalizedId !== "god" && !isValidUser(normalizedId)) {
      return { success: false, error: "Invalid Student ID" };
    }

    const email = studentIdToEmail(normalizedId);

    // Try sign in first
    const paddedPassword = padPassword(password);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: paddedPassword,
    });

    if (!signInError) {
      return { success: true };
    }

    // If user doesn't exist, sign up (first-time login)
    if (signInError.message?.includes("Invalid login credentials")) {
      const division = normalizedId === "god" ? "CS" : getDivision(normalizedId);
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password: paddedPassword,
        options: {
          data: {
            student_id: normalizedId,
            division,
            name: normalizedId,
          },
        },
      });

      if (signUpError) {
        return { success: false, error: signUpError.message };
      }

      // Auto-confirm is enabled, so sign in immediately
      const { error: retryError } = await supabase.auth.signInWithPassword({
        email,
        password: paddedPassword,
      });

      if (retryError) {
        return { success: false, error: retryError.message };
      }

      return { success: true };
    }

    return { success: false, error: signInError.message || "Login failed" };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const updateProfile = async (data: Partial<UserData>) => {
    if (!user?.supabaseId) return;

    const updates: any = {};
    if (data.name) updates.name = data.name;
    if (data.avatarUrl !== undefined) updates.avatar_url = data.avatarUrl;
    if (data.division) updates.division = data.division;
    if (data.bio !== undefined) updates.bio = data.bio;

    await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.supabaseId);

    setUser((prev) => prev ? { ...prev, ...data } : prev);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateProfile, isLoggedIn: !!user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
