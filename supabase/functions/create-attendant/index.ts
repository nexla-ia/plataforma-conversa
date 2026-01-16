import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateAttendantRequest {
  name: string;
  email: string;
  password: string;
  phone: string;
  company_id: string;
  department_id: string | null;
  sector_id: string | null;
  is_active: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requestUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !requestUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: isSuperAdmin } = await supabaseAdmin
      .from("super_admins")
      .select("user_id")
      .eq("user_id", requestUser.id)
      .maybeSingle();

    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("id")
      .eq("user_id", requestUser.id)
      .maybeSingle();

    if (!isSuperAdmin && !company) {
      return new Response(
        JSON.stringify({ error: "Only super admins or company admins can create attendants" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body: CreateAttendantRequest = await req.json();
    const { name, email, password, phone, company_id, department_id, sector_id, is_active } = body;

    if (!name || !email || !password || !company_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: name, email, password, company_id" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (company && company.id !== company_id) {
      return new Response(
        JSON.stringify({ error: "Company admins can only create attendants for their own company" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: authUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password: password,
      email_confirm: true,
      user_metadata: {
        name: name,
        role: "attendant",
      },
    });

    if (createUserError || !authUser.user) {
      return new Response(
        JSON.stringify({ error: createUserError?.message || "Failed to create user" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: attendant, error: insertError } = await supabaseAdmin
      .from("attendants")
      .insert({
        user_id: authUser.user.id,
        company_id: company_id,
        department_id: department_id || null,
        sector_id: sector_id || null,
        name: name,
        email: email.trim(),
        phone: phone || "",
        is_active: is_active !== undefined ? is_active : true,
      })
      .select()
      .single();

    if (insertError) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        attendant: attendant,
        message: "Attendant created successfully"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
