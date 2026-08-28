import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 5; // max 5 requests per minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(JSON.stringify({ error: "Server config error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth header");

    // Verify caller is god
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) throw new Error("Unauthorized");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: godRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "god")
      .maybeSingle();

    if (!godRole) throw new Error("Not a god user");

    // Rate limit check
    if (!checkRateLimit(caller.id)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in a minute." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, userId, newPassword } = await req.json();

    if (action === "reset_password") {
      if (!userId || !newPassword) throw new Error("Missing userId or newPassword");
      if (newPassword.length < 4) throw new Error("Password must be at least 4 characters");

      const paddedPassword = newPassword + "_nf2026!";
      const { error } = await adminClient.auth.admin.updateUserById(userId, {
        password: paddedPassword,
      });
      if (error) throw error;

      // Audit log
      await adminClient.from("activity_logs").insert({
        user_id: caller.id,
        action: "god_reset_password",
        details: `Reset password for user ${userId}`,
        page: "/god",
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset_all_to_username") {
      // Page through every auth user and set their password to their student_id
      let updated = 0;
      let skipped = 0;
      let page = 1;
      const perPage = 200;
      // Cap iterations to avoid runaway loops
      for (let i = 0; i < 20; i++) {
        const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
        if (error) throw error;
        const users = data?.users || [];
        if (users.length === 0) break;
        for (const u of users) {
          const studentId: string = u.user_metadata?.student_id || "";
          // Skip god account and any user without a student_id
          if (!studentId || studentId.toLowerCase() === "god") { skipped++; continue; }
          const padded = studentId + "_nf2026!";
          const { error: upErr } = await adminClient.auth.admin.updateUserById(u.id, {
            password: padded,
          });
          if (upErr) { skipped++; continue; }
          updated++;
        }
        if (users.length < perPage) break;
        page++;
      }

      await adminClient.from("activity_logs").insert({
        user_id: caller.id,
        action: "god_reset_all_passwords",
        details: `Bulk reset to username: updated=${updated} skipped=${skipped}`,
        page: "/god",
      });

      return new Response(JSON.stringify({ success: true, updated, skipped }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_users") {
      const { data: { users }, error } = await adminClient.auth.admin.listUsers({ perPage: 200 });
      if (error) throw error;
      const userMap = users.map((u) => ({
        id: u.id,
        email: u.email,
        student_id: u.user_metadata?.student_id || "",
        created_at: u.created_at,
        last_sign_in: u.last_sign_in_at,
      }));

      // Audit log
      await adminClient.from("activity_logs").insert({
        user_id: caller.id,
        action: "god_list_users",
        details: `Listed ${userMap.length} users`,
        page: "/god",
      });

      return new Response(JSON.stringify({ users: userMap }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
