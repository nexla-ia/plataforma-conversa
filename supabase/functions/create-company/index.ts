import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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
  max_attendants?: number;
  payment_notification_day?: number;
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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
      console.error("Missing environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const authHeader = req.headers.get("Authorization");
    console.log("Auth header received:", authHeader ? "present" : "missing");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error("Failed to get user:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: userError?.message }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const callerId = user.id;
    console.log("User authenticated:", callerId);

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    console.log("Checking if user is super admin:", callerId);
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from("super_admins")
      .select("user_id")
      .eq("user_id", callerId)
      .maybeSingle();

    console.log("Admin check result:", { adminData, adminError });

    if (adminError || !adminData) {
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
    const max_attendants = Number(body.max_attendants ?? 5);
    const payment_notification_day = Number(body.payment_notification_day ?? 5);

    console.log("Parsed fields:", { email, name, phone_number, api_key, max_attendants, payment_notification_day, passwordLength: password.length });

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

    console.log("Creating user in auth.users...");
    const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    console.log("User creation result:", { newUser, createUserError });

    if (createUserError || !newUser.user) {
      console.error("User creation failed:", createUserError);
      return new Response(
        JSON.stringify({
          error: "Erro ao criar usuário",
          details: createUserError?.message || "Unknown error",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const newUserId = newUser.user.id;
    console.log("User created successfully with ID:", newUserId);

    console.log("Inserting company into database...");
    const companyData = {
      name,
      phone_number,
      api_key,
      email,
      user_id: newUserId,
      is_super_admin: false,
      max_attendants,
      payment_notification_day,
    };
    console.log("Company data to insert:", JSON.stringify(companyData));

    const { error: insertError } = await supabaseAdmin
      .from("companies")
      .insert(companyData);

    console.log("Company insertion result:", { insertError });

    if (insertError) {
      console.error("Company insertion failed:", insertError);

      console.log("Rolling back: deleting user...");
      await supabaseAdmin.auth.admin.deleteUser(newUserId);

      return new Response(
        JSON.stringify({
          error: "Erro ao inserir empresa",
          details: insertError.message || "Unknown error",
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
