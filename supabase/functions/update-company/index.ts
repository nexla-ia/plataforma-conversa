import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface UpdateCompanyPayload {
  id: string;
  name?: string;
  phone_number?: string;
  api_key?: string;
  max_attendants?: number;
  payment_notification_day?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
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

    const token = authHeader.replace("Bearer ", "");
    const supabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: companyData, error: companyError } = await supabaseClient
      .from("companies")
      .select("id, is_super_admin")
      .eq("user_id", user.id)
      .eq("is_super_admin", true)
      .maybeSingle();

    if (companyError || !companyData || !companyData.is_super_admin) {
      return new Response(
        JSON.stringify({ error: "Access denied. Only super admins can update companies." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const payload: UpdateCompanyPayload = await req.json();

    if (!payload.id) {
      return new Response(
        JSON.stringify({ error: "Company ID is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const updateData: any = {};
    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.phone_number !== undefined) updateData.phone_number = payload.phone_number;
    if (payload.api_key !== undefined) updateData.api_key = payload.api_key;
    if (payload.max_attendants !== undefined) updateData.max_attendants = payload.max_attendants;
    if (payload.payment_notification_day !== undefined) updateData.payment_notification_day = payload.payment_notification_day;

    const { data: updatedCompany, error: updateError } = await supabaseClient
      .from("companies")
      .update(updateData)
      .eq("id", payload.id)
      .select()
      .single();

    if (updateError) {
      return new Response(
        JSON.stringify({ error: updateError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ data: updatedCompany }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
