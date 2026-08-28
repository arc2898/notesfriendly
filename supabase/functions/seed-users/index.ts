import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generateRandomPassword(length = 12): string {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join("");
}

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_COOLDOWN = 300_000; // 5 minutes between seed calls

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

    // Verify caller is god
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth header");

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
    const lastCall = rateLimitMap.get(caller.id) || 0;
    if (Date.now() - lastCall < RATE_LIMIT_COOLDOWN) {
      return new Response(JSON.stringify({ error: "Seed can only be run once every 5 minutes." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    rateLimitMap.set(caller.id, Date.now());

    // Generate all student IDs
    const studentIds: { id: string; division: string }[] = [];
    for (let i = 1; i <= 61; i++) {
      studentIds.push({ id: `CS${String(i).padStart(2, "0")}`, division: "CS" });
    }
    for (let i = 1; i <= 60; i++) {
      studentIds.push({ id: `BS${String(i).padStart(2, "0")}`, division: "BS" });
    }
    for (let i = 1; i <= 60; i++) {
      studentIds.push({ id: `IT${String(i).padStart(2, "0")}`, division: "IT" });
    }

    // Check which users already exist
    const { data: existingProfiles } = await adminClient
      .from("profiles")
      .select("student_id");
    const existingIds = new Set((existingProfiles || []).map((p: any) => p.student_id));

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];
    const createdCredentials: { id: string; password: string }[] = [];

    for (const student of studentIds) {
      if (existingIds.has(student.id)) {
        skipped++;
        continue;
      }

      const email = `${student.id.toLowerCase()}@students.notesfriendly.app`;
      const randomPassword = generateRandomPassword();
      const authPassword = randomPassword + "_nf2026!";

      const { error } = await adminClient.auth.admin.createUser({
        email,
        password: authPassword,
        email_confirm: true,
        user_metadata: {
          student_id: student.id,
          division: student.division,
          name: student.id,
        },
      });

      if (error) {
        errors.push(`${student.id}: ${error.message}`);
      } else {
        created++;
        createdCredentials.push({ id: student.id, password: randomPassword });
      }
    }

    // Audit log
    await adminClient.from("activity_logs").insert({
      user_id: caller.id,
      action: "god_seed_users",
      details: `Seeded ${created} users, skipped ${skipped}, errors: ${errors.length}`,
      page: "/god",
    });

    return new Response(JSON.stringify({
      created,
      skipped,
      errors: errors.slice(0, 10),
      total: studentIds.length,
      credentials: createdCredentials,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
