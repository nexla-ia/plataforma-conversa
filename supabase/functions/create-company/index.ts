import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

type Payload = {
  email: string;
  password: string;
  name: string;
  phone_number: string;
  api_key: string;
};

Deno.serve(async (req: Request) => {
  // ✅ Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE) {
      return new Response(
        JSON.stringify({
          error:
            "Secrets ausentes: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Cliente com JWT do usuário (pra validar quem está chamando)
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ 
        error: "Invalid user session",
        details: userErr?.message || "No user data returned"
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = userData.user.id;

    // Cliente admin para verificar super admin (bypassa RLS)
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ✅ Check super admin via tabela super_admins usando service role
    const { data: saRow, error: saErr } = await adminClient
      .from("super_admins")
      .select("user_id")
      .eq("user_id", callerId)
      .maybeSingle();

    if (saErr || !saRow) {
      return new Response(JSON.stringify({
        error: "Not allowed",
        details: saErr?.message || "User is not a super admin"
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: Partial<Payload> = await req.json().catch(() => ({}));

    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "").trim();
    const name = String(body.name ?? "").trim();
    const phone_number = String(body.phone_number ?? "").trim();
    const api_key = String(body.api_key ?? "").trim();

    if (!email || !password || !name || !phone_number || !api_key) {
      return new Response(
        JSON.stringify({
          error: "Campos obrigatórios: email, password, name, phone_number, api_key",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 1) Criar usuário no auth.users
    const { data: newUserData, error: signUpError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (signUpError || !newUserData.user) {
      return new Response(
        JSON.stringify({ error: `Erro ao criar usuário: ${signUpError?.message || 'Usuário não retornado'}` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const newUserId = newUserData.user.id;

    // 2) Inserir empresa com o user_id do novo usuário
    const { error: insErr } = await adminClient.from("companies").insert({
      name,
      phone_number,
      api_key,
      email,
      user_id: newUserId,
      is_super_admin: false,
    });

    if (insErr) {
      // Tentar deletar o usuário criado se houver erro
      await adminClient.auth.admin.deleteUser(newUserId);

      return new Response(JSON.stringify({ error: `Erro ao inserir empresa: ${insErr.message}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        company: { name, email, phone_number, api_key, user_id: newUserId },
        message: "Empresa e usuário criados com sucesso",
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