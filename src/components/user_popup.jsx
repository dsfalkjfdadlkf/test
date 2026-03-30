import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { app_config } from "../config";
import { use_auth } from "../auth";
import { CheckmarkIcon, UserIcon } from "../icons";
import { useNavigate } from "react-router-dom";

export default function UserPopup({ username, close }) {
  const { user: current_user } = use_auth();
  const navigate = useNavigate();
  const [profile, set_profile] = useState(null);
  const [loading, set_loading] = useState(true);
  const [is_following, set_is_following] = useState(false);

  useEffect(() => {
    load_profile();
  }, [username]);

  const load_profile = async () => {
    const { data } = await supabase.from("web_profiles").select("*").ilike("username", username).limit(1).single();
    if (data) {
      set_profile(data);
      if (current_user) {
        const { data: follow } = await supabase
          .from("follows")
          .select("*")
          .eq("follower_id", current_user.user_id)
          .eq("following_id", data.user_id)
          .single();
        set_is_following(!!follow);
      }
    }
    set_loading(false);
  };

  const toggle_follow = async () => {
    if (!current_user || !profile) return;
    if (is_following) {
      await supabase.from("follows").delete().eq("follower_id", current_user.user_id).eq("following_id", profile.user_id);
      set_is_following(false);
    } else {
      await supabase.from("follows").insert({ follower_id: current_user.user_id, following_id: profile.user_id });
      set_is_following(true);
      await supabase.from("notifications").insert({
        user_id: profile.user_id,
        type: "follow",
        from_user_id: current_user.user_id,
        from_username: current_user.display_name || current_user.username,
        content: "started following you"
      });
    }
  };

  return (
    <div className="auth_modal_overlay" onClick={close} style={{ zIndex: 10000 }}>
      <div className="auth_modal" onClick={(e) => e.stopPropagation()} style={{ width: 340, padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center" }}><div className="spinner" /></div>
        ) : !profile ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>User not found</div>
        ) : (
          <div>
            <div style={{ height: 100, background: profile.banner_url ? `url(${profile.banner_url}) center/cover` : "var(--bg-tertiary)" }} />
            <div style={{ padding: "0 16px 16px", position: "relative" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: -32, marginBottom: 12 }}>
                <div style={{ position: "relative" }}>
                  <img src={profile.avatar_url || "https://cdn.discordapp.com/embed/avatars/0.png"} alt="" style={{ width: 72, height: 72, borderRadius: "50%", border: "4px solid var(--bg-card)", objectFit: "cover", backgroundColor: "var(--bg-card)" }} />
                  {app_config.owner_ids.includes(profile.user_id) && (
                    <div style={{ position: "absolute", bottom: 0, right: 0 }}>
                      <CheckmarkIcon size={20} />
                    </div>
                  )}
                </div>
                {current_user && current_user.user_id !== profile.user_id && (
                  <button className={`btn_secondary ${is_following ? "following" : ""}`} style={{ width: "auto", padding: "6px 16px", minHeight: 32, fontSize: 13, borderColor: is_following ? "var(--border)" : "var(--text-primary)", color: is_following ? "var(--text-primary)" : "var(--bg-primary)", background: is_following ? "transparent" : "var(--text-primary)" }} onClick={toggle_follow}>
                    {is_following ? "Unfollow" : "Follow"}
                  </button>
                )}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                {profile.display_name || profile.username}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>@{profile.username}</div>
              {profile.bio && <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>{profile.bio}</div>}
              {profile.pronouns && <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, marginBottom: 16 }}>PRONOUNS: <span style={{ textTransform: "none", color: "var(--text-secondary)", fontWeight: 400, marginLeft: 4 }}>{profile.pronouns}</span></div>}
              
              <button className="btn_secondary" style={{ width: "100%", fontSize: 13, padding: "8px" }} onClick={() => { close(); navigate(`/user/${profile.user_id}`); }}>
                View Full Profile
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
