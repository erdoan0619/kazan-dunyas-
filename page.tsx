"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Task = { id: string; title: string; description: string; points: number };
type Profile = { username: string; points_balance: number; role: "user" | "admin" };

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = url && anon ? createClient(url, anon) : null;

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"tasks" | "history" | "admin">("tasks");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPoints, setNewPoints] = useState(10);

  async function refresh() {
    if (!supabase) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setProfile(null); return; }
    const [{ data: p }, { data: t }, { data: h }] = await Promise.all([
      supabase.from("profiles").select("username,points_balance,role").eq("id", auth.user.id).single(),
      supabase.from("tasks").select("id,title,description,points").eq("active", true).order("created_at", { ascending: false }),
      supabase.from("point_ledger").select("id,delta,reason,created_at").order("created_at", { ascending: false }).limit(30)
    ]);
    setProfile(p as Profile | null);
    setTasks((t || []) as Task[]);
    setHistory(h || []);
  }

  useEffect(() => { refresh(); }, []);

  async function auth(action: "signup" | "login") {
    if (!supabase) return setMessage("Önce .env.local dosyasına Supabase bilgilerini ekleyin.");
    setBusy(true); setMessage("");
    const result = action === "signup"
      ? await supabase.auth.signUp({ email, password, options: { data: { username } } })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (result.error) return setMessage(result.error.message);
    setMessage(action === "signup" ? "Kayıt isteği alındı. E-posta doğrulaması gerekiyorsa gelen kutunuzu kontrol edin." : "Giriş başarılı.");
    await refresh();
  }

  async function logout() {
    await supabase?.auth.signOut(); setProfile(null); setHistory([]); setMessage("Oturum kapatıldı.");
  }

  async function completeTask(taskId: string) {
    if (!supabase) return;
    setBusy(true); setMessage("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setBusy(false); return setMessage("Önce giriş yapın."); }
    const response = await fetch(`${url}/functions/v1/complete-task`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ task_id: taskId })
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    setMessage(response.ok ? `Görev tamamlandı. +${body.points_awarded} puan kazandınız.` : (body.error || "Görev tamamlanamadı."));
    await refresh();
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const { error } = await supabase.from("tasks").insert({
      title: newTitle, description: newDescription, points: newPoints
    });
    setMessage(error ? error.message : "Görev eklendi.");
    setNewTitle(""); setNewDescription(""); setNewPoints(10); await refresh();
  }

  return <main className="shell">
    <header className="top">
      <div className="brand"><div className="logo">₺</div><div><h1>Kazanç Dünyası</h1><p>Görevlerini tamamla, puanlarını takip et.</p></div></div>
      {profile && <button className="ghost" onClick={logout}>Çıkış yap</button>}
    </header>

    {!profile ? <section className="auth card">
      <div><span className="eyebrow">HOŞ GELDİN</span><h2>Hesabına giriş yap</h2><p className="muted">Yeniysen kullanıcı adıyla kayıt oluşturabilirsin.</p></div>
      <label>Kullanıcı adı (kayıt için)<input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Kullanıcı adın" maxLength={30}/></label>
      <label>E-posta<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="ornek@eposta.com" autoComplete="email"/></label>
      <label>Parola<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="En az 8 karakter" minLength={8} autoComplete="current-password"/></label>
      <div className="actions"><button disabled={busy || !email || password.length < 8} onClick={()=>auth("login")}>Giriş yap</button><button className="secondary" disabled={busy || !email || password.length < 8 || username.trim().length < 2} onClick={()=>auth("signup")}>Kayıt ol</button></div>
      <p className="tiny">Parolalar uygulama veritabanında düz metin olarak tutulmaz; kimlik doğrulamayı Supabase Auth yönetir.</p>
    </section> : <>
      <section className="welcome">
        <div><span className="eyebrow">KİŞİSEL PANEL</span><h2>Merhaba, {profile.username} 👋</h2><p className="muted">Bugün yeni görevleri keşfet.</p></div>
        <div className="balance"><span>Toplam puanın</span><strong>{profile.points_balance.toLocaleString("tr-TR")}</strong><small>PUAN</small></div>
      </section>
      <nav className="tabs">
        <button className={tab==="tasks"?"active":""} onClick={()=>setTab("tasks")}>Görevler</button>
        <button className={tab==="history"?"active":""} onClick={()=>setTab("history")}>Puan geçmişi</button>
        {profile.role==="admin" && <button className={tab==="admin"?"active":""} onClick={()=>setTab("admin")}>Yönetici</button>}
      </nav>
      {tab==="tasks" && <section className="grid">
        {tasks.map(task=><article className="task card" key={task.id}><div className="task-icon">✦</div><div className="task-body"><h3>{task.title}</h3><p>{task.description}</p><strong>+{task.points} puan</strong></div><button disabled={busy} onClick={()=>completeTask(task.id)}>Tamamla</button></article>)}
        {tasks.length===0 && <p className="muted">Şu anda aktif görev yok.</p>}
      </section>}
      {tab==="history" && <section className="card"><h3>Puan hareketleri</h3>{history.map(row=><div className="history" key={row.id}><div><b>{row.reason}</b><small>{new Date(row.created_at).toLocaleString("tr-TR")}</small></div><strong className={row.delta>=0?"plus":"minus"}>{row.delta>0?"+":""}{row.delta}</strong></div>)}{history.length===0&&<p className="muted">Henüz işlem bulunmuyor.</p>}</section>}
      {tab==="admin" && profile.role==="admin" && <section className="card"><h3>Yeni görev ekle</h3><form onSubmit={addTask} className="form"><label>Görev başlığı<input value={newTitle} onChange={e=>setNewTitle(e.target.value)} required maxLength={80}/></label><label>Açıklama<input value={newDescription} onChange={e=>setNewDescription(e.target.value)} required maxLength={300}/></label><label>Puan<input type="number" min="1" max="1000" value={newPoints} onChange={e=>setNewPoints(Number(e.target.value))}/></label><button>Görevi yayınla</button></form><p className="tiny">Yönetici rolü yalnızca güvenilir sunucu/SQL işlemiyle atanmalıdır. Kullanıcı arayüzünden rol yükseltilemez.</p></section>}
    </>}
    {message && <div className="notice" role="status">{message}</div>}
    <footer>© {new Date().getFullYear()} Kazanç Dünyası <span>•</span> Güvenli ve şeffaf puan deneyimi</footer>
  </main>;
}
