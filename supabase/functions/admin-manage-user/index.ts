import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create authenticated client with user's token
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: {
            Authorization: req.headers.get("Authorization")!,
          },
        },
      }
    );

    // Create admin client for auth operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify user is authenticated
    const { data: userData } = await supabaseClient.auth.getUser();
    if (!userData.user) {
      return new Response(
        JSON.stringify({ error: "Não autenticado" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify user is admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Acesso negado. Apenas administradores podem gerenciar usuários." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const { action, ...params } = await req.json();

    // Handle actions
    if (action === "create_user") {
      return await handleCreateUser(supabaseAdmin, params);
    } else if (action === "update_profile") {
      return await handleUpdateProfile(supabaseAdmin, params);
    } else if (action === "reset_password") {
      return await handleResetPassword(supabaseAdmin, params);
    } else if (action === "toggle_active") {
      return await handleToggleActive(supabaseAdmin, params);
    } else {
      return new Response(
        JSON.stringify({ error: "Ação inválida" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function handleCreateUser(supabaseAdmin: any, params: any) {
  const { email, full_name, role, departamento, telefone, password } = params;

  if (!email || !full_name) {
    return new Response(
      JSON.stringify({ error: "Email e nome completo são obrigatórios" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Create auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: password || Math.random().toString(36).slice(-12),
    email_confirm: false,
  });

  if (authError) {
    return new Response(
      JSON.stringify({ error: `Erro ao criar usuário: ${authError.message}` }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Create profile
  const { data: profileData, error: profileError } = await supabaseAdmin
    .from("profiles")
    .insert({
      id: authData.user.id,
      email,
      full_name,
      role: role || null,
      departamento: departamento || null,
      telefone: telefone || null,
      ativo: true,
    })
    .select()
    .single();

  if (profileError) {
    // Clean up auth user if profile creation fails
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return new Response(
      JSON.stringify({ error: `Erro ao criar perfil: ${profileError.message}` }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "Usuário criado com sucesso!",
      user: profileData,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

async function handleUpdateProfile(supabaseAdmin: any, params: any) {
  const { user_id, role, departamento, telefone, ativo } = params;

  if (!user_id) {
    return new Response(
      JSON.stringify({ error: "user_id é obrigatório" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({
      role: role || null,
      departamento: departamento || null,
      telefone: telefone || null,
      ativo: ativo !== undefined ? ativo : true,
    })
    .eq("id", user_id)
    .select()
    .single();

  if (error) {
    return new Response(
      JSON.stringify({ error: `Erro ao atualizar usuário: ${error.message}` }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  return new Response(
    JSON.stringify({ success: true, message: "Usuário atualizado com sucesso!", user: data }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

async function handleResetPassword(supabaseAdmin: any, params: any) {
  const { user_id, email } = params;

  if (!user_id && !email) {
    return new Response(
      JSON.stringify({ error: "user_id ou email é obrigatório" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Send password reset email
  const { error } = await supabaseAdmin.auth.resetPasswordForEmail(
    email || (await supabaseAdmin.from("profiles").select("email").eq("id", user_id).single()).data.email
  );

  if (error) {
    return new Response(
      JSON.stringify({ error: `Erro ao enviar email: ${error.message}` }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "Email de redefinição de senha enviado com sucesso!",
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

async function handleToggleActive(supabaseAdmin: any, params: any) {
  const { user_id } = params;

  if (!user_id) {
    return new Response(
      JSON.stringify({ error: "user_id é obrigatório" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Get current status
  const { data: current } = await supabaseAdmin
    .from("profiles")
    .select("ativo")
    .eq("id", user_id)
    .single();

  // Toggle
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ ativo: !current?.ativo })
    .eq("id", user_id)
    .select()
    .single();

  if (error) {
    return new Response(
      JSON.stringify({ error: `Erro ao atualizar status: ${error.message}` }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "Status do usuário atualizado com sucesso!",
      user: data,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
