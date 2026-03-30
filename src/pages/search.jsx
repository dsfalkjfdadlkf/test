import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { app_config } from "../config";
import { SearchIcon, HeartIcon, MessageIcon, CheckmarkIcon } from "../icons";

export default function SearchPage() {
  const navigate = useNavigate();
  const [query, set_query] = useState("");
  const [results, set_results] = useState([]);
  const [user_results, set_user_results] = useState([]);
  const [searching, set_searching] = useState(false);
  const [tab, set_tab] = useState("threads");

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        do_search();
      } else {
        set_results([]);
        set_user_results([]);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const do_search = async () => {
    if (!query.trim()) return;
    set_searching(true);

    const { data: threads } = await supabase
      .from("reports")
      .select("*")
      .eq("status", "approved")
      .eq("server_id", app_config.server_id)
      .or(`name.ilike.%${query}%,title.ilike.%${query}%,description.ilike.%${query}%,reported_id.ilike.%${query}%,type.ilike.%${query}%`)
      .order("created_at", { ascending: false })
      .limit(30);
    set_results(threads || []);

    const { data: users } = await supabase
      .from("web_profiles")
      .select("*")
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .limit(20);
    set_user_results(users || []);

    set_searching(false);
  };

  const time_ago = (d) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <>
      <div className="page_header">
        <h1>Search</h1>
        <div className="page_header_sub">find threads and users</div>
      </div>
      <div className="page_body">
        <div className="search_bar_wrap">
          <SearchIcon />
          <input
            className="search_input"
            placeholder="search threads, users, IDs..."
            value={query}
            onChange={(e) => set_query(e.target.value)}
          />
          <button className="btn_primary" style={{ padding: "8px 20px", fontSize: 13, flexShrink: 0, width: "auto", minWidth: 80 }} onClick={do_search}>
            search
          </button>
        </div>

        <div className="tab_bar" style={{ marginTop: 16 }}>
          <button className={`tab_btn ${tab === "threads" ? "active" : ""}`} onClick={() => set_tab("threads")}>
            threads ({results.length})
          </button>
          <button className={`tab_btn ${tab === "users" ? "active" : ""}`} onClick={() => set_tab("users")}>
            users ({user_results.length})
          </button>
        </div>

        {searching ? (
          <div className="loading_spinner"><div className="spinner" /></div>
        ) : tab === "threads" ? (
          <div className="threads_grid">
            {results.map((t, idx) => (
              <div
                key={t.report_id}
                className="thread_card"
                onClick={() => navigate(`/thread/${t.report_id}`)}
                style={{ animationDelay: `${idx * 0.04}s`, animation: "fade_in_up 0.3s ease forwards", opacity: 0 }}
              >
                <div className="thread_type_badge">{t.type}</div>
                <div className="thread_title" style={{ fontSize: 16, marginBottom: 4 }}>
                  {t.title || "Untitled Thread"}
                  {t.submitted_by_tag && (
                    <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 400, marginLeft: 8, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      by {t.submitted_by_tag}
                      {app_config.owner_ids.includes(t.submitted_by_id) && <CheckmarkIcon size={14} />}
                    </span>
                  )}
                </div>
                <div className="thread_desc" style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{t.name} — {t.reported_id}</div>
                <div className="thread_desc">{t.description}</div>
                <div className="thread_time" style={{ marginTop: 8 }}>{time_ago(t.created_at)}</div>
              </div>
            ))}
            {results.length === 0 && !searching && query && (
              <div className="empty_state">
                <div className="empty_state_text">no threads found</div>
              </div>
            )}
          </div>
        ) : (
          <div className="threads_grid">
            {user_results.map((u, idx) => (
              <div
                key={u.user_id}
                className="thread_card"
                onClick={() => navigate(`/user/${u.user_id}`)}
                style={{ animationDelay: `${idx * 0.04}s`, animation: "fade_in_up 0.3s ease forwards", opacity: 0, display: "flex", alignItems: "center", gap: 12 }}
              >
                <img
                  src={u.avatar_url || "https://cdn.discordapp.com/embed/avatars/0.png"}
                  alt=""
                  style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                />
                <div>
                  <div className="thread_title" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {u.display_name || u.username}
                    {app_config.owner_ids.includes(u.user_id) && <CheckmarkIcon size={16} />}
                  </div>
                  <div className="thread_desc">@{u.username}</div>
                </div>
              </div>
            ))}
            {user_results.length === 0 && !searching && query && (
              <div className="empty_state">
                <div className="empty_state_text">no users found</div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
