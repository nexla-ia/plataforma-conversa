import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  // Em DEV pode deixar "*". Em produção, troque pelo seu domínio.
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

Deno.serve(async (req: Request) => {
  // ✅ Preflight CORS (o navegador chama antes do POST)
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // (Opcional) bloquear qualquer método que não seja POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { email, password } = await req.json().catch(() => ({}));

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email e senha são obrigatórios" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return new Response(
        JSON.stringify({
          error:
            "Secrets ausentes: SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ✅ Admin client (service_role) - nunca use isso no front
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verificar se já existe
    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    const existing = list?.users?.find((u) => u.email === email);

    let userId = existing?.id;
    let userEmail = existing?.email;

    if (!existing) {
      // ✅ Criar usuário já confirmado
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (error || !data?.user) {
        return new Response(JSON.stringify({ error: error?.message ?? "Falha" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userId = data.user.id;
      userEmail = data.user.email;
    }

    // Garantir registro na companies como super admin
    const { data: companyData } = await supabaseAdmin
      .from("companies")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!companyData) {
      const { error: insertErr } = await supabaseAdmin.from("companies").insert({
        user_id: userId,
        email: userEmail,
        name: "Super Admin",
        phone_number: "",
        api_key: `super_admin_${Date.now()}`,
        is_super_admin: true,
      });

      if (insertErr) {
        return new Response(JSON.stringify({ error: insertErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        user: { id: userId, email: userEmail },
        message: existing
          ? "Usuário já existia e foi garantido como super admin"
          : "Super admin criado e confirmado",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
