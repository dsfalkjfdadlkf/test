import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { app_config } from "../config";
import { use_auth } from "../auth";
import { BellIcon, HeartIcon, MessageIcon, UserIcon, ArrowLeftIcon, CheckmarkIcon } from "../icons";

export default function NotificationsPage() {
  const { user } = use_auth();
  const navigate = useNavigate();
  const [notifs, set_notifs] = useState([]);
  const [loading, set_loading] = useState(true);
  const [users_map, set_users_map] = useState({});

  useEffect(() => {
    if (user) load_notifs();
  }, [user]);

  const load_notifs = async () => {
    set_loading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.user_id)
      .order("created_at", { ascending: false })
      .limit(50);
    set_notifs(data || []);

    if (data && data.length > 0) {
      const uids = [...new Set(data.map((d) => d.from_user_id))];
      const { data: profs } = await supabase.from("web_profiles").select("user_id, avatar_url, display_name, username").in("user_id", uids);
      const pm = {};
      (profs || []).forEach((p) => (pm[p.user_id] = p));
      set_users_map(pm);
    }
    set_loading(false);

    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.user_id)
      .eq("read", false);
  };

  const time_ago = (d) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(d).toLocaleDateString();
  };

  const get_icon = (type) => {
    const style = { width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", padding: 4 };
    if (type === "like") return <span style={{ backgroundColor: "var(--accent)", color: "white", ...style }}><HeartIcon filled={true} /></span>;
    if (type === "comment") return <span style={{ backgroundColor: "var(--discord-blue)", color: "white", ...style }}><MessageIcon /></span>;
    if (type === "follow") return <span style={{ backgroundColor: "var(--success)", color: "white", ...style }}><UserIcon /></span>;
    if (type === "reply") return <span style={{ backgroundColor: "var(--warning)", color: "white", ...style }}><ArrowLeftIcon /></span>;
    return <span style={{ backgroundColor: "var(--text-muted)", color: "white", ...style }}><BellIcon /></span>;
  };

  const format_content = (n) => {
    if (n.type === "like") return "has liked your forum";
    if (n.type === "follow") return "has started following you!";
    if (n.type === "comment") return "commented on your forum click to see!";
    if (n.type === "reply") return "replied to your comment click to see!";
    if (n.type === "rating") {
      const num = n.content.match(/(\d)\/5/) ? n.content.match(/(\d)\/5/)[1] : "?";
      return `has put a ${num} review on your forum!`;
    }
    if (n.type === "mention") return "mentioned you click to see!";
    return n.content;
  };

  return (
    <>
      <div className="page_header">
        <h1>Notifications</h1>
        <div className="page_header_sub">likes, comments, and activity on your reports</div>
      </div>
      <div className="notifications_page">
        {loading ? (
          <div className="loading_spinner"><div className="spinner" /></div>
        ) : notifs.length === 0 ? (
          <div className="empty_state">
            <BellIcon />
            <div className="empty_state_title">no notifications yet</div>
            <div className="empty_state_text">activity on your reports will show up here</div>
          </div>
        ) : (
          notifs.map((n, idx) => (
            <div
              key={n.id}
              className={`notif_item ${!n.read ? "unread" : ""}`}
              onClick={() => n.report_id && navigate(`/thread/${n.report_id}`)}
              style={{ animationDelay: `${idx * 0.03}s`, animation: "fade_in_up 0.3s ease forwards", opacity: 0, display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}
            >
              <div style={{ position: "relative", flexShrink: 0, width: 44, height: 44 }}>
                <img
                  src={users_map[n.from_user_id]?.avatar_url || "https://cdn.discordapp.com/embed/avatars/0.png"}
                  alt=""
                  style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", cursor: "pointer" }}
                  onClick={(e) => { e.stopPropagation(); navigate(`/user/${n.from_user_id}`); }}
                />
                <div style={{ position: "absolute", bottom: -4, right: -4, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {get_icon(n.type)}
                </div>
              </div>
              
              <div className="notif_content" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <div className="notif_text" style={{ fontSize: 14, lineHeight: 1.4, color: "var(--text-primary)" }}>
                  <strong
                    className="mention_link"
                    style={{ cursor: "pointer", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}
                    onClick={(e) => { e.stopPropagation(); navigate(`/user/${n.from_user_id}`); }}
                  >
                    {users_map[n.from_user_id]?.display_name || n.from_username}
                    {app_config.owner_ids.includes(n.from_user_id) && <CheckmarkIcon size={14} />}
                  </strong>{" "}
                  <span style={{ color: "var(--text-secondary)" }}>{format_content(n)}</span>
                </div>
                <div className="notif_time">{time_ago(n.created_at)}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
