import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
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
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
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
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
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
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userId = user.id;

    // Buscar a empresa do usuário
    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("id, name, payment_notification_day")
      .eq("user_id", userId)
      .maybeSingle();

    if (companyError || !company) {
      return new Response(
        JSON.stringify({ error: "Company not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const paymentDay = company.payment_notification_day || 5;

    console.log("Processing notifications for company:", company.name);
    console.log("Current day:", currentDay, "Payment day:", paymentDay);

    // Se for dia 27, limpar todas as notificações de pagamento antigas
    if (currentDay === 27) {
      console.log("Day 27 - Cleaning old payment notifications");
      const { error: deleteError } = await supabaseAdmin
        .from("notifications")
        .delete()
        .eq("company_id", company.id)
        .eq("type", "payment");

      if (deleteError) {
        console.error("Error deleting old notifications:", deleteError);
      } else {
        console.log("Old payment notifications deleted successfully");
      }
    }

    // Verificar se estamos dentro do período de notificação (5 dias até o payment_day)
    const daysBeforePayment = 5;
    const startDay = paymentDay - daysBeforePayment + 1;

    let isInNotificationPeriod = false;
    let daysUntilPayment = 0;

    if (startDay > 0) {
      // Período dentro do mesmo mês
      isInNotificationPeriod = currentDay >= startDay && currentDay <= paymentDay;
      daysUntilPayment = paymentDay - currentDay;
    } else {
      // Período cruza o mês anterior
      const daysInPreviousMonth = new Date(currentYear, currentMonth, 0).getDate();
      const startDayAdjusted = daysInPreviousMonth + startDay;

      if (currentDay >= startDayAdjusted) {
        // Estamos no mês anterior
        isInNotificationPeriod = true;
        daysUntilPayment = (daysInPreviousMonth - currentDay) + paymentDay;
      } else if (currentDay <= paymentDay) {
        // Estamos no mês do pagamento
        isInNotificationPeriod = true;
        daysUntilPayment = paymentDay - currentDay;
      }
    }

    console.log("Is in notification period:", isInNotificationPeriod);
    console.log("Days until payment:", daysUntilPayment);

    if (isInNotificationPeriod) {
      // Verificar se já existe notificação de pagamento para hoje
      const todayStart = new Date(currentYear, currentMonth, currentDay, 0, 0, 0);
      const todayEnd = new Date(currentYear, currentMonth, currentDay, 23, 59, 59);

      const { data: existingNotifications, error: checkError } = await supabaseAdmin
        .from("notifications")
        .select("id")
        .eq("company_id", company.id)
        .eq("type", "payment")
        .gte("created_at", todayStart.toISOString())
        .lte("created_at", todayEnd.toISOString());

      if (checkError) {
        console.error("Error checking existing notifications:", checkError);
      }

      // Se não existe notificação para hoje, criar uma
      if (!existingNotifications || existingNotifications.length === 0) {
        let title = "";
        let message = "";

        if (daysUntilPayment === 0) {
          // Último dia - aviso final
          title = "🚨 AVISO FINAL - Pagamento Vence Hoje!";
          message = `Hoje é o último dia para realizar o pagamento! Dia ${paymentDay}. Por favor, efetue o pagamento para evitar interrupções no serviço.`;
        } else if (daysUntilPayment === 1) {
          title = "⚠️ Lembrete de Pagamento - Vence Amanhã";
          message = `Seu pagamento vence amanhã, dia ${paymentDay}. Faltam apenas ${daysUntilPayment} dia. Não esqueça de efetuar o pagamento.`;
        } else {
          title = "💰 Lembrete de Pagamento";
          message = `Seu pagamento vence no dia ${paymentDay}. Faltam ${daysUntilPayment} dias. Lembre-se de efetuar o pagamento em dia.`;
        }

        const { error: insertError } = await supabaseAdmin
          .from("notifications")
          .insert({
            company_id: company.id,
            title,
            message,
            type: "payment",
            is_read: false,
          });

        if (insertError) {
          console.error("Error creating notification:", insertError);
        } else {
          console.log("Payment notification created successfully");
        }
      } else {
        console.log("Notification already exists for today");
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Notifications checked successfully",
        currentDay,
        paymentDay,
        isInNotificationPeriod,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    const errorStack = e instanceof Error ? e.stack : '';

    console.error("Error in check-payment-notifications:", {
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
