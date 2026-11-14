import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "http://localhost:3000",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Oturum gerekli." }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: "Geçersiz oturum." }, 401);

  let body: { task_id?: string };
  try { body = await req.json(); } catch { return json({ error: "Geçersiz JSON." }, 400); }
  if (!body.task_id || !/^[0-9a-f-]{36}$/i.test(body.task_id)) return json({ error: "Geçerli görev seçin." }, 400);

  const admin = createClient(url, service);
  const { data: task, error: taskError } = await admin.from("tasks")
    .select("id,title,points,active").eq("id", body.task_id).eq("active", true).single();
  if (taskError || !task) return json({ error: "Görev bulunamadı veya aktif değil." }, 404);

  // The server takes points from the database. Client-supplied point values are ignored.
  const { data: completion, error: completionError } = await admin.from("task_completions")
    .insert({ user_id: user.id, task_id: task.id, points_awarded: task.points })
    .select("id").single();
  if (completionError) {
    if (completionError.code === "23505") return json({ error: "Bu görevi daha önce tamamladınız." }, 409);
    return json({ error: "Görev kaydedilemedi." }, 500);
  }

  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("points_balance").eq("id", user.id).single();
  if (profileError || !profile) {
    await admin.from("task_completions").delete().eq("id", completion.id);
    return json({ error: "Hesap bulunamadı." }, 500);
  }

  const newBalance = Number(profile.points_balance) + task.points;
  const { error: balanceError } = await admin.from("profiles")
    .update({ points_balance: newBalance }).eq("id", user.id);
  if (balanceError) {
    await admin.from("task_completions").delete().eq("id", completion.id);
    return json({ error: "Puan bakiyesi güncellenemedi." }, 500);
  }

  const { error: ledgerError } = await admin.from("point_ledger").insert({
    user_id: user.id, delta: task.points, reason: `Görev: ${task.title}`,
    task_completion_id: completion.id
  });
  if (ledgerError) return json({ error: "Puan işlendi ancak hareket kaydı hatası oluştu. Destek ekibine başvurun." }, 500);
  return json({ ok: true, points_awarded: task.points, balance: newBalance }, 200);
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...cors, "Content-Type": "application/json" }
  });
}
