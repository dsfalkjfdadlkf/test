import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { use_auth } from "../auth";
import { app_config } from "../config";
import { CrownIcon, PencilIcon, CheckmarkIcon } from "../icons";

export default function ProfilePage() {
  const { user, refresh_profile } = use_auth();
  const navigate = useNavigate();
  const avatar_ref = useRef(null);
  const banner_ref = useRef(null);
  const presence_ref = useRef(null);
  
  const [editing, set_editing] = useState(false);
  const [show_presence, set_show_presence] = useState(false);
  const [form, set_form] = useState({ status_presence: "online", display_name: "", username: "", bio: "", pronouns: "" });
  const [stats, set_stats] = useState({ followers: 0, following: 0, total_likes: 0 });
  const [my_threads, set_my_threads] = useState([]);
  const [action_logs, set_action_logs] = useState([]);
  const [tab, set_tab] = useState("threads");
  const [toast, set_toast] = useState(null);
  const [cache_burst] = useState(Date.now());
  const [lightbox, set_lightbox] = useState(null);

  const is_owner = user ? app_config.owner_ids.includes(user.user_id) : false;

  useEffect(() => {
    if (user) {
      set_form({
        status_presence: user.status_presence || "online",
        display_name: user.display_name || "",
        username: user.username || "",
        bio: user.bio || "",
        pronouns: user.pronouns || ""
      });
      load_stats();
      load_threads();
      if (is_owner) load_logs();
    }
  }, [user]);

  useEffect(() => {
    const handle_click_outside = (e) => {
      if (presence_ref.current && !presence_ref.current.contains(e.target)) {
        set_show_presence(false);
      }
    };
    document.addEventListener("mousedown", handle_click_outside);
    return () => document.removeEventListener("mousedown", handle_click_outside);
  }, []);

  const show_toast = (msg, type = "success") => {
    set_toast({ msg, type });
    setTimeout(() => set_toast(null), 3000);
  };

  const load_stats = async () => {
    const { data: followers } = await supabase.from("follows").select("id").eq("following_id", user.user_id);
    const { data: following } = await supabase.from("follows").select("id").eq("follower_id", user.user_id);
    const { data: reports } = await supabase.from("reports").select("report_id").eq("submitted_by_id", user.user_id).eq("status", "approved");
    let total_likes = 0;
    if (reports && reports.length > 0) {
      const rids = reports.map((r) => r.report_id);
      const { data: likes } = await supabase.from("thread_likes").select("id").in("report_id", rids);
      total_likes = (likes || []).length;
    }
    set_stats({ followers: (followers || []).length, following: (following || []).length, total_likes });
  };

  const load_threads = async () => {
    const { data: my_data } = await supabase
      .from("reports")
      .select("*")
      .eq("submitted_by_id", user.user_id)
      .order("created_at", { ascending: false });
    
    let all = my_data || [];

    if (is_owner) {
      const { data: pending_data } = await supabase
        .from("reports")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      
      if (pending_data) {
        const existing_ids = new Set(all.map(t => t.report_id));
        const extra = pending_data.filter(t => !existing_ids.has(t.report_id));
        all = [...all, ...extra];
      }
    }
    set_my_threads(all);
  };

  const load_logs = async () => {
    const { data } = await supabase
      .from("action_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    set_action_logs(data || []);
  };

  const get_badges = () => {
    const badges = [];
    if (is_owner) {
      badges.push({ name: "owner", label: "Owner", class: "owner_badge" });
    }
    const sorted = [...app_config.badge_thresholds].sort((a, b) => b.min - a.min);
    for (const b of sorted) {
      if (stats.followers >= b.min) {
        badges.push({ name: b.name, label: b.label, class: b.name });
        break;
      }
    }
    return badges;
  };

  const upload_image = async (file, type) => {
    const ext = file.name.split(".").pop();
    const path = `profiles/${user.user_id}_${type}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("attachments").upload(path, file, { upsert: true });
    if (error) {
      console.error("Upload error:", error);
      show_toast(`upload failed: ${error.message}`, "error");
      return null;
    }
    const { data } = supabase.storage.from("attachments").getPublicUrl(path);
    return data.publicUrl;
  };

  const handle_avatar_change = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    show_toast("uploading avatar...");
    const url = await upload_image(file, "avatar");
    if (url) {
      await supabase.from("web_profiles").update({ avatar_url: url }).eq("user_id", user.user_id);
      refresh_profile();
      show_toast("avatar updated");
    }
  };

  const handle_banner_change = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    show_toast("uploading banner...");
    const url = await upload_image(file, "banner");
    if (url) {
      const { error } = await supabase.from("web_profiles").update({ banner_url: url }).eq("user_id", user.user_id);
      if (error) {
        show_toast(`banner update failed: ${error.message}`, "error");
        return;
      }
      refresh_profile();
      show_toast("banner updated");
    }
  };

  const update_presence = async (status) => {
    set_form({ ...form, status_presence: status });
    await supabase.from("web_profiles").update({ status_presence: status }).eq("user_id", user.user_id);
    refresh_profile();
    set_show_presence(false);
  };

  const save_profile = async () => {
    await supabase.from("web_profiles").update({
      display_name: form.display_name,
      username: form.username,
      bio: form.bio,
      pronouns: form.pronouns
    }).eq("user_id", user.user_id);
    refresh_profile();
    set_editing(false);
    show_toast("profile saved");
  };

  const handle_moderate = async (e, thread, new_status) => {
    e.stopPropagation();
    await supabase.from("reports").update({ status: new_status }).eq("report_id", thread.report_id);
    await supabase.from("action_logs").insert({
      user_id: user.user_id,
      username: user.display_name || user.username,
      action: new_status === "approved" ? "APPROVED_REPORT" : "DECLINED_REPORT",
      target_id: thread.report_id,
      details: thread.name
    });
    set_my_threads((prev) => prev.map(t => t.report_id === thread.report_id ? { ...t, status: new_status } : t));
    show_toast(`Report ${new_status}`);
    if (is_owner) load_logs();
  };

  if (!user) return null;

  const badges = get_badges();

  return (
    <>
      <div className="page_header">
        <h1>Profile</h1>
        <div className="page_header_sub">manage your identity</div>
      </div>
      <div className="profile_page">
        <div
          className="profile_banner editable"
          onClick={() => banner_ref.current?.click()}
          style={{ cursor: "pointer" }}
        >
          {user.banner_url ? (
            <img src={`${user.banner_url}?t=${cache_burst}`} alt="" />
          ) : (
            <div style={{ width: "100%", height: "100%" }} />
          )}
          <PencilIcon className="edit_overlay_icon" size={32} />
          <input ref={banner_ref} type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={handle_banner_change} />
        </div>

        <div className="profile_info_section" style={{ animation: "fade_in_up 0.4s ease" }}>
          <div className="profile_avatar_wrap editable" style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); avatar_ref.current?.click();}}>
            <img src={user.avatar_url ? `${user.avatar_url}?t=${cache_burst}` : "https://cdn.discordapp.com/embed/avatars/0.png"} alt="" className="profile_avatar" onDoubleClick={(e) => { e.stopPropagation(); set_lightbox(user.avatar_url); }} />
            <PencilIcon className="edit_overlay_icon" size={28} />
            <input ref={avatar_ref} type="file" accept="image/*" style={{ display: "none" }} onChange={handle_avatar_change} />
            
            {is_owner ? (
              <div className="checkmark_badge">
                <CheckmarkIcon size={22} />
              </div>
            ) : (
              <div 
                className={`presence_dot ${form.status_presence || "online"}`} 
                onClick={(e) => { e.stopPropagation(); set_show_presence(!show_presence); }}
                ref={presence_ref}
              >
                {show_presence && (
                  <div className="presence_menu" onClick={(e) => e.stopPropagation()}>
                    <div className="presence_menu_item" onClick={() => update_presence("online")}>
                      <div className="presence_menu_dot online"></div>
                      <div>Online</div>
                    </div>
                    <div className="presence_menu_item" onClick={() => update_presence("idle")}>
                      <div className="presence_menu_dot idle"></div>
                      <div>Idle</div>
                    </div>
                    <div className="presence_menu_item" onClick={() => update_presence("dnd")}>
                      <div className="presence_menu_dot dnd"></div>
                      <div>
                        <div>Do Not Disturb</div>
                        <div className="presence_menu_desc">You will not receive desktop notifications</div>
                      </div>
                    </div>
                    <div className="presence_menu_item" onClick={() => update_presence("invisible")}>
                      <div className="presence_menu_dot invisible"></div>
                      <div>
                        <div>Invisible</div>
                        <div className="presence_menu_desc">You will appear offline</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {badges.length > 0 && (
            <div className="profile_badges">
              {badges.map((b) => (
                <span key={b.name} className={`profile_badge ${b.class}`}>
                  {b.name === "owner" && <CrownIcon />}
                  {b.label}
                </span>
              ))}
            </div>
          )}

          {editing ? (
            <div className="edit_profile_section" style={{ marginTop: 0, border: "none", padding: 0 }}>
              <div className="form_group">
                <label className="form_label">display name</label>
                <input className="form_input" value={form.display_name} onChange={(e) => set_form({ ...form, display_name: e.target.value })} />
              </div>
              <div className="form_group">
                <label className="form_label">username</label>
                <input className="form_input" value={form.username} onChange={(e) => set_form({ ...form, username: e.target.value })} />
              </div>
              <div className="form_group">
                <label className="form_label">pronouns</label>
                <input className="form_input" placeholder="e.g. he/him, she/her, they/them" value={form.pronouns} onChange={(e) => set_form({ ...form, pronouns: e.target.value })} />
              </div>
              <div className="form_group">
                <label className="form_label">bio</label>
                <textarea className="form_input" style={{ minHeight: 80 }} placeholder="tell us about yourself..." value={form.bio} onChange={(e) => set_form({ ...form, bio: e.target.value })} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn_primary" style={{ width: "auto", padding: "10px 32px", fontSize: 14 }} onClick={save_profile}>save profile</button>
                <button className="btn_secondary" onClick={() => set_editing(false)}>cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="profile_display_name">
                {user.display_name || user.username}
                {is_owner && <span className="owner_crown" style={{ marginLeft: 6 }}><CrownIcon /></span>}
              </div>
              <div className="profile_username">@{user.username}</div>
              {user.pronouns && <div className="profile_pronouns">{user.pronouns}</div>}
              {user.bio && <div className="profile_bio">{user.bio}</div>}
              <div className="profile_stats">
                <div className="profile_stat"><strong>{stats.followers}</strong> followers</div>
                <div className="profile_stat"><strong>{stats.following}</strong> following</div>
                <div className="profile_stat"><strong>{stats.total_likes}</strong> likes</div>
              </div>
              <button className="btn_secondary" onClick={() => set_editing(true)}>edit profile</button>
            </>
          )}
        </div>

        <div style={{ marginTop: 24 }}>
          <div className="tab_bar">
            <button className={`tab_btn ${tab === "threads" ? "active" : ""}`} onClick={() => set_tab("threads")}>threads</button>
            <button className={`tab_btn ${tab === "approved" ? "active" : ""}`} onClick={() => set_tab("approved")}>approved</button>
            <button className={`tab_btn ${tab === "pending" ? "active" : ""}`} onClick={() => set_tab("pending")}>pending</button>
            {is_owner && <button className={`tab_btn ${tab === "logs" ? "active" : ""}`} onClick={() => set_tab("logs")}>logs</button>}
          </div>

          {tab === "logs" && is_owner ? (
            <div className="logs_section">
              {action_logs.map((log) => (
                <div key={log.id} style={{ background: "var(--bg-card)", padding: 14, borderRadius: 10, marginBottom: 10, border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      <strong style={{ color: "var(--text-primary)" }}>{log.username}</strong>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(log.created_at).toLocaleString()}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: log.action.includes("APPROVED") ? "var(--success)" : log.action.includes("DECLINED") ? "var(--warning)" : log.action.includes("DELETED") ? "var(--danger)" : "var(--accent)", marginBottom: 4 }}>{log.action}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Report: {log.target_id}</div>
                  {log.details && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{log.details}</div>}
                  {log.before_data && (
                    <div style={{ marginTop: 8, padding: 8, background: "var(--bg-primary)", borderRadius: 6, fontSize: 12 }}>
                      <div style={{ color: "var(--danger)", fontWeight: 600, marginBottom: 4 }}>Before:</div>
                      {Object.entries(log.before_data).map(([k, v]) => (
                        <div key={k} style={{ color: "var(--text-muted)" }}><strong>{k}:</strong> {v}</div>
                      ))}
                    </div>
                  )}
                  {log.after_data && (
                    <div style={{ marginTop: 4, padding: 8, background: "var(--bg-primary)", borderRadius: 6, fontSize: 12 }}>
                      <div style={{ color: "var(--success)", fontWeight: 600, marginBottom: 4 }}>After:</div>
                      {Object.entries(log.after_data).map(([k, v]) => (
                        <div key={k} style={{ color: "var(--text-muted)" }}><strong>{k}:</strong> {v}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {action_logs.length === 0 && <div className="empty_state"><div className="empty_state_text">no logs recorded</div></div>}
            </div>
          ) : (
            <>
              {my_threads
                .filter((t) => {
                  if (tab === "approved") return t.status === "approved";
                  if (tab === "pending") return t.status === "pending";
                  return true;
                })
                .map((t, idx) => (
                  <div
                    key={t.report_id}
                    className="thread_card"
                    onClick={() => t.status === "approved" || is_owner ? navigate(`/thread/${t.report_id}`) : null}
                    style={{ marginBottom: 12, cursor: t.status === "approved" || is_owner ? "pointer" : "default", animationDelay: `${idx * 0.04}s`, animation: "fade_in_up 0.3s ease forwards", opacity: 0 }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div className="thread_type_badge">{t.type}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {is_owner && t.status === "pending" && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="btn_primary" style={{ padding: "4px 12px", background: "var(--success)" }} onClick={(e) => handle_moderate(e, t, "approved")}>Accept</button>
                            <button className="btn_primary" style={{ padding: "4px 12px", background: "var(--danger)" }} onClick={(e) => handle_moderate(e, t, "declined")}>Reject</button>
                          </div>
                        )}
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: t.status === "approved" ? "rgba(34,197,94,0.1)" : t.status === "pending" ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)",
                          color: t.status === "approved" ? "var(--success)" : t.status === "pending" ? "var(--warning)" : "var(--danger)"
                        }}>
                          {t.status}
                        </span>
                      </div>
                    </div>
                    <div className="thread_title" style={{ fontSize: 16, marginBottom: 4 }}>{t.title || "Untitled Thread"} <span style={{fontSize: 12, color: "var(--text-muted)", fontWeight: 400}}>by {t.submitted_by_tag}</span></div>
                    <div className="thread_desc" style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{t.name} — {t.reported_id}</div>
                    <div className="thread_desc">{t.description}</div>
                    {is_owner && t.status === "pending" && t.attachments && t.attachments.length > 0 && (
                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        {t.attachments.map((a, i) => <img key={i} src={a.url} alt="" style={{ width: 40, height: 40, borderRadius: 4, objectFit: "cover" }} />)}
                      </div>
                    )}
                  </div>
                ))}
            </>
          )}

          {tab !== "logs" && my_threads.length === 0 && (
            <div className="empty_state">
              <div className="empty_state_title">no threads yet</div>
              <div className="empty_state_text">no reports found here</div>
            </div>
          )}
        </div>
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      {lightbox && (
        <div className="image_lightbox" onClick={() => set_lightbox(null)}>
          <img src={lightbox} alt="" />
        </div>
      )}
    </>
  );
}
