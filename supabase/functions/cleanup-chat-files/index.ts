import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Require either a valid scheduler secret OR a god-role JWT to invoke
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const cleanupSecret = Deno.env.get("CLEANUP_CHAT_FILES_SECRET");

  // Path 1: scheduled invocation with shared secret header
  const providedSecret = req.headers.get("x-cleanup-secret");
  let authorized = !!cleanupSecret && providedSecret === cleanupSecret;

  // Path 2: human invocation with valid god-role JWT
  if (!authorized) {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userResp, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userResp?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Check god role using service-role client to bypass RLS
    const adminClient = createClient(url, serviceRole);
    const { data: roleRow } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userResp.user.id)
      .eq("role", "god")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    authorized = true;
  }

  if (!authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(url, serviceRole);

  try {
    // Find expired, not-yet-deleted attachments
    const { data: expired, error } = await supabase
      .from("chat_attachments")
      .select("id, file_path")
      .lt("expires_at", new Date().toISOString())
      .is("deleted_at", null)
      .limit(500);

    if (error) throw error;
    if (!expired || expired.length === 0) {
      return new Response(JSON.stringify({ deleted: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paths = expired.map((a) => a.file_path);
    const ids = expired.map((a) => a.id);

    // Remove from storage
    const { error: rmErr } = await supabase.storage.from("chat-files").remove(paths);
    if (rmErr) console.error("storage remove error:", rmErr);

    // Mark as deleted in DB
    await supabase
      .from("chat_attachments")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", ids);

    // Do NOT leak file paths in the response
    return new Response(JSON.stringify({ deleted: ids.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("cleanup error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
