import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type Payload = {
  email: string;
  password: string;
  name: string;
  phone_number: string;
  api_key: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    console.log("Auth header received:", authHeader ? "present" : "missing");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid Authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    console.log("Token length:", token.length);

    // Decodificar JWT para obter o user_id
    let callerId: string;
    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        console.error("Invalid JWT format: expected 3 parts, got", parts.length);
        return new Response(JSON.stringify({ error: "Invalid JWT token format" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const payload = JSON.parse(atob(parts[1]));
      console.log("Decoded JWT payload sub:", payload.sub);
      callerId = payload.sub;

      if (!callerId) {
        console.error("No user ID in token payload");
        return new Response(JSON.stringify({ error: "Invalid token: no user ID" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (decodeError) {
      console.error("Error decoding JWT:", decodeError);
      return new Response(
        JSON.stringify({
          error: "Failed to decode JWT",
          details: decodeError instanceof Error ? decodeError.message : String(decodeError)
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verificar se o usuário é super admin
    console.log("Checking if user is super admin:", callerId);
    const checkAdminRes = await fetch(
      `${SUPABASE_URL}/rest/v1/super_admins?user_id=eq.${callerId}&select=user_id`,
      {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Admin check status:", checkAdminRes.status);
    const adminData = await checkAdminRes.json();
    console.log("Admin data:", JSON.stringify(adminData));

    if (!Array.isArray(adminData) || adminData.length === 0) {
      console.error("User is not a super admin");
      return new Response(
        JSON.stringify({
          error: "Access denied",
          details: "User is not a super admin",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Super admin verified successfully");

    // Parse body
    const body: Partial<Payload> = await req.json().catch(() => ({}));
    console.log("Request body received:", JSON.stringify(body));

    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "").trim();
    const name = String(body.name ?? "").trim();
    const phone_number = String(body.phone_number ?? "").trim();
    const api_key = String(body.api_key ?? "").trim();

    console.log("Parsed fields:", { email, name, phone_number, api_key, passwordLength: password.length });

    if (!email || !password || !name || !phone_number || !api_key) {
      console.error("Missing required fields");
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

    // Criar usuário no auth.users usando Admin API
    console.log("Creating user in auth.users...");
    const createUserRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users`,
      {
        method: "POST",
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          email_confirm: true,
        }),
      }
    );

    console.log("User creation status:", createUserRes.status);

    if (!createUserRes.ok) {
      const errorData = await createUserRes.json();
      console.error("User creation failed:", JSON.stringify(errorData));
      return new Response(
        JSON.stringify({
          error: "Erro ao criar usuário",
          details: errorData.msg || errorData.message || "Unknown error",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userData = await createUserRes.json();
    const newUserId = userData.id;
    console.log("User created successfully with ID:", newUserId);

    // Inserir empresa na tabela companies
    console.log("Inserting company into database...");
    const companyData = {
      name,
      phone_number,
      api_key,
      email,
      user_id: newUserId,
      is_super_admin: false,
    };
    console.log("Company data to insert:", JSON.stringify(companyData));

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/companies`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(companyData),
    });

    console.log("Company insertion status:", insertRes.status);

    if (!insertRes.ok) {
      const errorText = await insertRes.text();
      console.error("Company insertion failed. Status:", insertRes.status, "Response:", errorText);

      // Deletar usuário se inserção falhar
      console.log("Rolling back: deleting user...");
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${newUserId}`, {
        method: "DELETE",
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
      });

      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { message: errorText };
      }

      return new Response(
        JSON.stringify({
          error: "Erro ao inserir empresa",
          details: errorData.message || errorData.msg || "Unknown error",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Company inserted successfully");

    return new Response(
      JSON.stringify({
        ok: true,
        company: { name, email, phone_number, api_key, user_id: newUserId },
        message: "Empresa e usuário criados com sucesso",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    const errorStack = e instanceof Error ? e.stack : '';

    console.error("Error in create-company:", {
      message: errorMessage,
      stack: errorStack,
      error: e
    });

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
