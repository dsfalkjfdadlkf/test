import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { use_auth } from "../auth";
import { app_config } from "../config";
import { ArrowLeftIcon, CrownIcon, CheckmarkIcon } from "../icons";

export default function UserProfilePage() {
  const { uid } = useParams();
  const { user } = use_auth();
  const navigate = useNavigate();
  const [profile, set_profile] = useState(null);
  const [loading, set_loading] = useState(true);
  const [stats, set_stats] = useState({ followers: 0, following: 0, total_likes: 0 });
  const [is_following, set_is_following] = useState(false);
  const [lightbox, set_lightbox] = useState(null);
  const [threads, set_threads] = useState([]);

  useEffect(() => {
    load_profile();
  }, [uid]);

  const load_profile = async () => {
    set_loading(true);
    const { data } = await supabase.from("web_profiles").select("*").eq("user_id", uid).single();
    if (data) {
      set_profile(data);
      await load_stats(data.user_id);
      await load_threads(data.user_id);
      await check_following(data.user_id);
    }
    set_loading(false);
  };

  const load_stats = async (uid) => {
    const { data: followers } = await supabase.from("follows").select("id").eq("following_id", uid);
    const { data: following } = await supabase.from("follows").select("id").eq("follower_id", uid);
    const { data: reports } = await supabase.from("reports").select("report_id").eq("submitted_by_id", uid).eq("status", "approved");
    let total_likes = 0;
    if (reports && reports.length > 0) {
      const rids = reports.map((r) => r.report_id);
      const { data: likes } = await supabase.from("thread_likes").select("id").in("report_id", rids);
      total_likes = (likes || []).length;
    }
    set_stats({ followers: (followers || []).length, following: (following || []).length, total_likes });
  };

  const load_threads = async (uid) => {
    const { data } = await supabase
      .from("reports")
      .select("*")
      .eq("submitted_by_id", uid)
      .eq("status", "approved")
      .order("created_at", { ascending: false });
    set_threads(data || []);
  };

  const check_following = async (target_id) => {
    if (!user) return;
    const { data } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", user.user_id)
      .eq("following_id", target_id)
      .single();
    set_is_following(!!data);
  };

  const toggle_follow = async () => {
    if (!user || !profile) return;
    if (is_following) {
      await supabase.from("follows").delete().eq("follower_id", user.user_id).eq("following_id", profile.user_id);
      set_is_following(false);
      set_stats((s) => ({ ...s, followers: s.followers - 1 }));
    } else {
      await supabase.from("follows").insert({ follower_id: user.user_id, following_id: profile.user_id });
      set_is_following(true);
      set_stats((s) => ({ ...s, followers: s.followers + 1 }));
      await supabase.from("notifications").insert({
        user_id: profile.user_id,
        type: "follow",
        from_user_id: user.user_id,
        from_username: user.display_name || user.username,
        content: "started following you"
      });
    }
  };

  const get_badges = () => {
    if (!profile) return [];
    const badges = [];
    if (app_config.owner_ids.includes(profile.user_id)) {
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

  if (loading) return <div className="loading_spinner"><div className="spinner" /></div>;
  if (!profile) return <div className="empty_state"><div className="empty_state_title">user not found</div></div>;

  const badges = get_badges();
  const is_self = user?.user_id === profile.user_id;

  return (
    <div className="profile_page">
      <button className="thread_detail_back" onClick={() => navigate(-1)}>
        <ArrowLeftIcon /> back
      </button>

      <div className="profile_banner" style={{ animation: "fade_in 0.4s ease", cursor: profile.banner_url ? "pointer" : "default" }} onClick={() => profile.banner_url && set_lightbox(profile.banner_url)}>
        {profile.banner_url ? (
          <img src={profile.banner_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "16px 16px 0 0" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", borderRadius: "16px 16px 0 0" }} />
        )}
      </div>

      <div className="profile_info_section" style={{ animation: "fade_in_up 0.4s ease" }}>
        <div className="profile_avatar_wrap">
          <img src={profile.avatar_url || "https://cdn.discordapp.com/embed/avatars/0.png"} alt="" className="profile_avatar" style={{ cursor: "pointer" }} onClick={() => set_lightbox(profile.avatar_url)} />
          {app_config.owner_ids.includes(profile.user_id) ? (
            <div className="checkmark_badge">
              <CheckmarkIcon size={22} />
            </div>
          ) : (
            <div className={`presence_dot ${profile.status_presence || "offline"}`} style={{ cursor: "default" }} />
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

        <div className="profile_display_name">
          {profile.display_name || profile.username}
          {app_config.owner_ids.includes(profile.user_id) && <span className="owner_crown" style={{ marginLeft: 6 }}><CrownIcon /></span>}
        </div>
        <div className="profile_username">@{profile.username}</div>
        {profile.pronouns && <div className="profile_pronouns">{profile.pronouns}</div>}
        {profile.bio && <div className="profile_bio">{profile.bio}</div>}

        <div className="profile_stats">
          <div className="profile_stat"><strong>{stats.followers}</strong> followers</div>
          <div className="profile_stat"><strong>{stats.following}</strong> following</div>
          <div className="profile_stat"><strong>{stats.total_likes}</strong> likes</div>
        </div>

        {!is_self && user && (
          <div className="profile_actions">
            <button className={`btn_follow ${is_following ? "following" : "not_following"}`} onClick={toggle_follow}>
              {is_following ? "unfollow" : "follow"}
            </button>
          </div>
        )}
        {is_self && (
          <button className="btn_secondary" onClick={() => navigate("/profile")}>edit profile</button>
        )}
      </div>

      <div style={{ marginTop: 24 }}>
        <div className="comments_title">Threads ({threads.length})</div>
        {threads.map((t, idx) => (
          <div
            key={t.report_id}
            className="thread_card"
            onClick={() => navigate(`/thread/${t.report_id}`)}
            style={{ marginBottom: 12, animationDelay: `${idx * 0.04}s`, animation: "fade_in_up 0.3s ease forwards", opacity: 0 }}
          >
            <div className="thread_type_badge">{t.type}</div>
            <div className="thread_title">{t.name}</div>
            <div className="thread_desc">{t.description}</div>
            <div className="thread_time" style={{ marginTop: 8 }}>{time_ago(t.created_at)}</div>
          </div>
        ))}
        {threads.length === 0 && (
          <div className="empty_state" style={{ padding: 40 }}>
            <div className="empty_state_text">no public threads</div>
          </div>
        )}
      </div>

      {lightbox && (
        <div className="image_lightbox" onClick={() => set_lightbox(null)}>
          <img src={lightbox} alt="" />
        </div>
      )}
    </div>
  );
}
