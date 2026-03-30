import { useNavigate, useLocation } from "react-router-dom";
import { use_auth } from "../auth";
import { app_config } from "../config";
import { supabase } from "../supabase";
import { useState, useEffect } from "react";
import { EyeIcon, HomeIcon, SearchIcon, PlusIcon, HeartIcon, LogoutIcon, CheckmarkIcon } from "../icons";

export default function Sidebar() {
  const { user, logout } = use_auth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unread, set_unread] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetch_unread = async () => {
      const { count } = await supabase.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", user.user_id).eq("read", false);
      set_unread(count || 0);
    };
    fetch_unread();
    const sub = supabase.channel("notifs_sidebar")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.user_id}` }, () => fetch_unread())
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, [user]);

  const nav_items = [
    { path: "/home", icon: <HomeIcon />, title: "Home" },
    { path: "/search", icon: <SearchIcon />, title: "Search" },
    { path: "/create", icon: <PlusIcon />, title: "Create" },
    { path: "/notifications", icon: <HeartIcon filled={false} />, title: "Activity" },
    { path: "/profile", icon: null, title: "Profile" }
  ];

  const handle_logout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="sidebar">
      <div className="sidebar_logo" style={{ cursor: "pointer" }} onClick={() => navigate("/home")}>
        <EyeIcon size={36} />
      </div>
      <div className="sidebar_divider" />
      {nav_items.map((item) => (
        <button
          key={item.path}
          className={`sidebar_btn ${location.pathname === item.path && item.path !== "/profile" ? "active" : ""}`}
          onClick={() => navigate(item.path)}
          title={item.title}
          style={{ background: item.path === "/profile" ? "transparent" : "" }}
        >
          {item.path === "/profile" && user ? (
            <div style={{ position: "relative" }}>
              <img
                src={user.avatar_url || "https://cdn.discordapp.com/embed/avatars/0.png"}
                alt=""
                style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: location.pathname === "/profile" ? "2px solid #fff" : "2px solid transparent", boxSizing: "border-box" }}
              />
              {user && app_config.owner_ids.includes(user.user_id) && (
                <div style={{ position: "absolute", bottom: -4, right: -4, display: "flex", filter: "drop-shadow(0 0 2px rgba(0,0,0,0.5))" }}>
                  <CheckmarkIcon size={14} />
                </div>
              )}
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              {item.icon}
              {item.path === "/notifications" && unread > 0 && (
                <div style={{ position: "absolute", top: -2, right: -4, width: 8, height: 8, background: "var(--danger)", borderRadius: "50%", border: "2px solid var(--bg-secondary)" }} />
              )}
            </div>
          )}
        </button>
      ))}
      <div className="sidebar_bottom">
        <button className="sidebar_btn" onClick={handle_logout} title="Logout">
          <LogoutIcon />
        </button>
      </div>
    </div>
  );
}
