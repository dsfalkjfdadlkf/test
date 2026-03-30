import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { app_config } from "../config";
import { use_auth } from "../auth";
import { HeartIcon, MessageIcon, StarIcon, CheckmarkIcon } from "../icons";

export default function HomePage() {
  const { user } = use_auth();
  const navigate = useNavigate();
  const [threads, set_threads] = useState([]);
  const [loading, set_loading] = useState(true);
  const [filter, set_filter] = useState("all");
  const [types, set_types] = useState([]);
  const [likes_map, set_likes_map] = useState({});
  const [comments_map, set_comments_map] = useState({});
  const [authors_map, set_authors_map] = useState({});

  useEffect(() => {
    load_types();
    load_threads();
  }, []);

  const load_types = async () => {
    const { data } = await supabase
      .from("report_types")
      .select("name")
      .eq("server_id", app_config.server_id);
    if (data) set_types(data.map((t) => t.name));
  };

  const load_threads = async () => {
    set_loading(true);
    const { data } = await supabase
      .from("reports")
      .select("*")
      .eq("status", "approved")
      .eq("server_id", app_config.server_id)
      .order("created_at", { ascending: false });

    if (data) {
      set_threads(data);
      const ids = data.map((t) => t.report_id);
      if (ids.length > 0) {
        const { data: likes } = await supabase
          .from("thread_likes")
          .select("report_id")
          .in("report_id", ids);
        const lm = {};
        (likes || []).forEach((l) => {
          lm[l.report_id] = (lm[l.report_id] || 0) + 1;
        });
        set_likes_map(lm);

        const { data: comments } = await supabase
          .from("thread_comments")
          .select("report_id")
          .in("report_id", ids);
        const cm = {};
        (comments || []).forEach((c) => {
          cm[c.report_id] = (cm[c.report_id] || 0) + 1;
        });
        set_comments_map(cm);

        const uids = [...new Set(data.map(d => d.submitted_by_id))];
        const { data: profs } = await supabase.from("web_profiles").select("user_id, avatar_url, display_name").in("user_id", uids);
        const pm = {};
        (profs || []).forEach(p => pm[p.user_id] = p);
        set_authors_map(pm);
      }
    }
    set_loading(false);
  };

  let filtered = [];
  if (filter === "all") {
    filtered = threads;
  } else if (filter === "popular") {
    filtered = [...threads].sort((a, b) => (likes_map[b.report_id] || 0) - (likes_map[a.report_id] || 0));
  } else {
    filtered = threads.filter((t) => t.type === filter);
  }

  const get_author_display = (thread) => {
    if (thread.anonymous) {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 500 }}>
          <img src="https://cdn.discordapp.com/embed/avatars/0.png" alt="" style={{ width: 18, height: 18, borderRadius: "50%" }} />
          Anonymous
        </div>
      );
    }
    const profile = authors_map[thread.submitted_by_id];
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 500 }}>
        <img src={profile?.avatar_url || "https://cdn.discordapp.com/embed/avatars/0.png"} alt="" style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover" }} />
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {profile?.display_name || thread.submitted_by_tag || "Unknown"}
          {app_config.owner_ids.includes(thread.submitted_by_id) && <CheckmarkIcon size={14} />}
        </span>
      </div>
    );
  };

  const time_ago = (date_str) => {
    const diff = Date.now() - new Date(date_str).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(date_str).toLocaleDateString();
  };

  return (
    <>
      <div className="page_header">
        <h1>Forums</h1>
        <div className="page_header_sub">browse approved reports from the community</div>
      </div>
      <div className="page_body">
        <div className="filter_bar">
          <button
            className={`filter_chip ${filter === "all" ? "active" : ""}`}
            onClick={() => set_filter("all")}
          >
            All
          </button>
          <button
            className={`filter_chip ${filter === "popular" ? "active" : ""}`}
            onClick={() => set_filter("popular")}
          >
            Popular
          </button>
          {types.map((t) => (
            <button
              key={t}
              className={`filter_chip ${filter === t ? "active" : ""}`}
              onClick={() => set_filter(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading_spinner"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty_state">
            <MessageIcon />
            <div className="empty_state_title">No threads yet</div>
            <div className="empty_state_text">be the first to create a report</div>
          </div>
        ) : (
          <div className="threads_grid">
            {filtered.map((thread, idx) => (
              <div
                key={thread.report_id}
                className="thread_card"
                onClick={() => navigate(`/thread/${thread.report_id}`)}
                style={{ animationDelay: `${idx * 0.05}s`, animation: "fade_in_up 0.4s ease forwards", opacity: 0 }}
              >
                <div className="thread_card_header">
                  <div>
                    <div className="thread_author">{get_author_display(thread)}</div>
                    <div className="thread_time">{time_ago(thread.created_at)}</div>
                  </div>
                </div>
                <div className="thread_type_badge">{thread.type}</div>
                <div className="thread_title" style={{ fontSize: 16, marginBottom: 4 }}>{thread.title || "Untitled Thread"}</div>
                <div className="thread_desc" style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{thread.name} — {thread.reported_id}</div>
                <div className="thread_desc">{thread.description}</div>
                {thread.attachments && thread.attachments.length > 0 && (
                  <div className="thread_attachments_preview">
                    {thread.attachments.slice(0, 3).map((a, i) =>
                      a.content_type && a.content_type.startsWith("image/") ? (
                        <img key={i} src={a.url} alt="" className="thread_attach_thumb" />
                      ) : null
                    )}
                  </div>
                )}
                <div className="thread_footer">
                  <div className="thread_stat">
                    <HeartIcon filled={false} />
                    {likes_map[thread.report_id] || 0}
                  </div>
                  <div className="thread_stat">
                    <MessageIcon />
                    {comments_map[thread.report_id] || 0}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
