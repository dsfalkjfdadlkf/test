import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { use_auth } from "../auth";
import { app_config } from "../config";
import { ArrowLeftIcon, HeartIcon, MessageIcon, StarIcon, TrashIcon, EditIcon, ReplyIcon, CheckmarkIcon } from "../icons";
import EmojiPicker from "emoji-picker-react";
import UserPopup from "../components/user_popup";

export default function ThreadPage() {
  const { id } = useParams();
  const { user } = use_auth();
  const navigate = useNavigate();
  const [thread, set_thread] = useState(null);
  const [author_profile, set_author_profile] = useState(null);
  const [loading, set_loading] = useState(true);
  const [liked, set_liked] = useState(false);
  const [like_count, set_like_count] = useState(0);
  const [comments, set_comments] = useState([]);
  const [comment_likes_map, set_comment_likes_map] = useState({});
  const [my_comment_likes, set_my_comment_likes] = useState(new Set());
  const [mention_popup, set_mention_popup] = useState(null);
  const [comment_text, set_comment_text] = useState("");
  const [reply_to, set_reply_to] = useState(null);
  const [editing_comment, set_editing_comment] = useState(null);
  const [edit_comment_text, set_edit_comment_text] = useState("");
  const [my_rating, set_my_rating] = useState(0);
  const [avg_rating, set_avg_rating] = useState({ average: 0, count: 0 });
  const [lightbox, set_lightbox] = useState(null);
  const [editing, set_editing] = useState(false);
  const [edit_form, set_edit_form] = useState({});
  const [toast, set_toast] = useState(null);
  const [show_emoji, set_show_emoji] = useState(false);
  const emoji_ref = useRef(null);
  const comment_input_ref = useRef(null);

  useEffect(() => { load_thread(); }, [id]);

  useEffect(() => {
    const h = (e) => { if (emoji_ref.current && !emoji_ref.current.contains(e.target)) set_show_emoji(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const show_toast = (msg, type = "success") => {
    set_toast({ msg, type });
    setTimeout(() => set_toast(null), 3000);
  };

  const load_thread = async () => {
    set_loading(true);
    const { data } = await supabase.from("reports").select("*").eq("report_id", id).single();
    if (data) {
      set_thread(data);
      set_edit_form({ title: data.title || "", name: data.name, reported_id: data.reported_id, description: data.description });
      if (!data.anonymous && data.submitted_by_id) {
        const { data: profile } = await supabase.from("web_profiles").select("*").eq("user_id", data.submitted_by_id).single();
        set_author_profile(profile);
      }
      await load_likes(data.report_id);
      await load_comments(data.report_id);
      await load_rating(data.report_id);
    }
    set_loading(false);
  };

  const load_likes = async (rid) => {
    const { data } = await supabase.from("thread_likes").select("*").eq("report_id", rid);
    set_like_count((data || []).length);
    if (user) set_liked((data || []).some((l) => l.user_id === user.user_id));
  };

  const load_comments = async (rid) => {
    const { data } = await supabase.from("thread_comments").select("*").eq("report_id", rid).order("created_at", { ascending: true });
    set_comments(data || []);
    if (data && data.length > 0) {
      const cids = data.map(c => c.id);
      const { data: cl } = await supabase.from("comment_likes").select("*").in("comment_id", cids);
      const lm = {};
      const my = new Set();
      (cl || []).forEach(l => {
        lm[l.comment_id] = (lm[l.comment_id] || 0) + 1;
        if (user && l.user_id === user.user_id) my.add(l.comment_id);
      });
      set_comment_likes_map(lm);
      set_my_comment_likes(my);
    }
  };

  const load_rating = async (rid) => {
    const { data } = await supabase.from("reviews").select("*").eq("report_id", rid);
    if (data && data.length > 0) {
      const total = data.reduce((s, r) => s + r.rating, 0);
      set_avg_rating({ average: total / data.length, count: data.length });
      if (user) {
        const mine = data.find((r) => r.user_id === user.user_id);
        if (mine) set_my_rating(mine.rating);
      }
    }
  };

  const toggle_like = async () => {
    if (!user) return;
    if (liked) {
      await supabase.from("thread_likes").delete().eq("report_id", id).eq("user_id", user.user_id);
      set_liked(false);
      set_like_count((c) => c - 1);
    } else {
      await supabase.from("thread_likes").insert({ report_id: id, user_id: user.user_id });
      set_liked(true);
      set_like_count((c) => c + 1);
      if (thread) {
        await supabase.from("notifications").insert({
          user_id: thread.submitted_by_id, type: "like",
          from_user_id: user.user_id, from_username: user.display_name || user.username,
          report_id: id, content: `liked your report "${thread.name}"`
        });
      }
    }
  };

  const toggle_comment_like = async (comment) => {
    if (!user) return;
    const is_liked = my_comment_likes.has(comment.id);
    if (is_liked) {
      await supabase.from("comment_likes").delete().eq("comment_id", comment.id).eq("user_id", user.user_id);
      set_my_comment_likes(prev => { const s = new Set(prev); s.delete(comment.id); return s; });
      set_comment_likes_map(prev => ({ ...prev, [comment.id]: (prev[comment.id] || 1) - 1 }));
    } else {
      await supabase.from("comment_likes").insert({ comment_id: comment.id, user_id: user.user_id });
      set_my_comment_likes(prev => new Set(prev).add(comment.id));
      set_comment_likes_map(prev => ({ ...prev, [comment.id]: (prev[comment.id] || 0) + 1 }));
      await supabase.from("notifications").insert({
        user_id: comment.user_id, type: "like",
        from_user_id: user.user_id, from_username: user.display_name || user.username,
        report_id: id, content: `liked your comment`
      });
    }
  };

  const parse_mentions = (text) => {
    const parts = text.split(/(@[\w.-]+)/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        const username = part.slice(1);
        return <span key={i} className="mention_link" onClick={(e) => { e.stopPropagation(); set_mention_popup(username); }}>@{username}</span>;
      }
      return part;
    });
  };

  const process_mentions = async (text) => {
    const mentions = text.match(/@([\w.-]+)/g);
    if (!mentions) return;
    for (const m of mentions) {
      const username = m.slice(1);
      const { data: found } = await supabase.from("web_profiles").select("user_id").ilike("username", username).limit(1).single();
      if (found) {
        await supabase.from("notifications").insert({
          user_id: found.user_id, type: "mention",
          from_user_id: user.user_id, from_username: user.display_name || user.username,
          report_id: id, content: `mentioned you in a comment`
        });
      }
    }
  };

  const submit_comment = async () => {
    if (!comment_text.trim() || !user) return;
    const payload = {
      report_id: id, user_id: user.user_id,
      username: user.display_name || user.username,
      avatar_url: user.avatar_url || "",
      content: comment_text.trim(),
      parent_id: reply_to?.id || null
    };
    await supabase.from("thread_comments").insert(payload);
    await process_mentions(comment_text);
    if (thread && thread.submitted_by_id !== user.user_id) {
      await supabase.from("notifications").insert({
        user_id: thread.submitted_by_id, type: reply_to ? "reply" : "comment",
        from_user_id: user.user_id, from_username: user.display_name || user.username,
        report_id: id, content: reply_to ? `replied to a comment on "${thread.name}"` : `commented on your report "${thread.name}"`
      });
    }
    if (reply_to && reply_to.user_id !== user.user_id && reply_to.user_id !== thread.submitted_by_id) {
      await supabase.from("notifications").insert({
        user_id: reply_to.user_id, type: "reply",
        from_user_id: user.user_id, from_username: user.display_name || user.username,
        report_id: id, content: `replied to your comment`
      });
    }
    set_comment_text("");
    set_reply_to(null);
    load_comments(id);
  };

  const delete_comment = async (comment) => {
    if (!user || comment.user_id !== user.user_id) return;
    await supabase.from("comment_likes").delete().eq("comment_id", comment.id);
    await supabase.from("thread_comments").delete().eq("id", comment.id);
    load_comments(id);
    show_toast("comment deleted");
  };

  const start_edit_comment = (comment) => {
    set_editing_comment(comment.id);
    set_edit_comment_text(comment.content);
  };

  const save_edit_comment = async (comment) => {
    if (!edit_comment_text.trim()) return;
    await supabase.from("thread_comments").update({
      content: edit_comment_text.trim(), edited: true, edited_at: new Date().toISOString()
    }).eq("id", comment.id);
    set_editing_comment(null);
    load_comments(id);
    show_toast("comment edited");
  };

  const submit_rating = async (val) => {
    if (!user || my_rating > 0) return;
    await supabase.from("reviews").upsert({ report_id: id, user_id: user.user_id, rating: val }, { onConflict: "report_id,user_id" });
    set_my_rating(val);
    load_rating(id);
    show_toast(`rated ${val}/5 stars`);
    if (thread && thread.submitted_by_id !== user.user_id) {
      await supabase.from("notifications").insert({
        user_id: thread.submitted_by_id, type: "rating",
        from_user_id: user.user_id, from_username: user.display_name || user.username,
        report_id: id, content: `rated your report "${thread.name}" ${val}/5 stars`
      });
    }
  };

  const delete_thread = async () => {
    if (!user) return;
    const can = thread.submitted_by_id === user.user_id || app_config.owner_ids.includes(user.user_id);
    if (!can || !window.confirm("are you sure you want to delete this report?")) return;
    await supabase.from("action_logs").insert({
      user_id: user.user_id, username: user.display_name || user.username,
      action: "DELETED_REPORT", target_id: thread.report_id,
      details: `Deleted report: ${thread.name}`,
      before_data: { name: thread.name, description: thread.description, reported_id: thread.reported_id }
    });
    await supabase.from("thread_likes").delete().eq("report_id", id);
    await supabase.from("thread_comments").delete().eq("report_id", id);
    await supabase.from("reviews").delete().eq("report_id", id);
    await supabase.from("reports").delete().eq("report_id", id);
    show_toast("report deleted");
    navigate("/home");
  };

  const update_status = async (new_status) => {
    if (!user) return;
    await supabase.from("reports").update({ status: new_status }).eq("report_id", id);
    await supabase.from("action_logs").insert({
      user_id: user.user_id, username: user.display_name || user.username,
      action: new_status === "approved" ? "APPROVED_REPORT" : "DECLINED_REPORT",
      target_id: id, details: thread.name
    });
    show_toast(`report ${new_status}`);
    load_thread();
  };

  const save_edit = async () => {
    const updates = {};
    if (edit_form.title !== thread.title) updates.title = edit_form.title;
    if (edit_form.name !== thread.name) updates.name = edit_form.name;
    if (edit_form.reported_id !== thread.reported_id) updates.reported_id = edit_form.reported_id;
    if (edit_form.description !== thread.description) updates.description = edit_form.description;
    if (Object.keys(updates).length === 0) { set_editing(false); return; }
    await supabase.from("action_logs").insert({
      user_id: user.user_id, username: user.display_name || user.username,
      action: "MODIFIED_REPORT", target_id: id,
      details: `Changed: ${Object.keys(updates).join(", ")}`,
      before_data: { title: thread.title, name: thread.name, description: thread.description, reported_id: thread.reported_id },
      after_data: updates
    });
    await supabase.from("reports").update(updates).eq("report_id", id);
    set_editing(false);
    show_toast("report updated");
    load_thread();
  };

  const time_ago = (d) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  if (loading) return <div className="loading_spinner"><div className="spinner" /></div>;
  if (!thread) return <div className="empty_state"><div className="empty_state_title">thread not found</div></div>;

  const is_author = user && thread.submitted_by_id === user.user_id;
  const is_admin = user && app_config.owner_ids.includes(user.user_id);
  const can_delete = is_author || is_admin;
  const can_edit = is_author;
  const can_approve_decline = is_admin;

  const top_comments = comments.filter(c => !c.parent_id);
  const get_replies = (parent_id) => comments.filter(c => c.parent_id === parent_id);

  const render_comment = (c, depth = 0, parent_comment = null) => {
    const replies = get_replies(c.id);
    const is_verified = app_config.owner_ids.includes(c.user_id);
    return (
      <div key={c.id} style={{ marginLeft: depth > 0 ? 24 : 0 }}>
        <div className="comment_item">
          <img src={c.avatar_url || "https://cdn.discordapp.com/embed/avatars/0.png"} alt="" className="comment_avatar" onClick={() => navigate(`/user/${c.user_id}`)} style={{ cursor: "pointer" }} />
          <div className="comment_content" style={{ flex: 1 }}>
            <div className="comment_author" onClick={() => navigate(`/user/${c.user_id}`)} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {c.username}
              {is_verified && <CheckmarkIcon size={14} />}
              {c.edited && <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 400 }}>(edited)</span>}
            </div>
            {parent_comment && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <ReplyIcon style={{ width: 12, height: 12 }} /> Replying to <span className="mention_link" onClick={(e) => { e.stopPropagation(); set_mention_popup(parent_comment.username); }}>@{parent_comment.username}</span>
              </div>
            )}
            {editing_comment === c.id ? (
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <input className="form_input" value={edit_comment_text} onChange={e => set_edit_comment_text(e.target.value)} style={{ fontSize: 13 }} onKeyDown={e => e.key === "Enter" && save_edit_comment(c)} />
                <button className="btn_primary" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => save_edit_comment(c)}>save</button>
                <button className="btn_secondary" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => set_editing_comment(null)}>cancel</button>
              </div>
            ) : (
              <div className="comment_text">{parse_mentions(c.content)}</div>
            )}
            <div className="comment_actions_row">
              <span className="comment_time">{time_ago(c.created_at)}</span>
              <button className={`comment_action_btn ${my_comment_likes.has(c.id) ? "liked" : ""}`} onClick={() => toggle_comment_like(c)}>
                <HeartIcon filled={my_comment_likes.has(c.id)} /> {comment_likes_map[c.id] || 0}
              </button>
              <button className="comment_action_btn" onClick={() => { set_reply_to(c); set_comment_text(`@${c.username} `); comment_input_ref.current?.focus(); }}>
                <ReplyIcon /> reply
              </button>
              {user && c.user_id === user.user_id && (
                <>
                  <button className="comment_action_btn" onClick={() => start_edit_comment(c)}>
                    <EditIcon /> edit
                  </button>
                  <button className="comment_action_btn" style={{ color: "var(--danger)" }} onClick={() => delete_comment(c)}>
                    <TrashIcon /> delete
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
        {replies.map(r => render_comment(r, depth + 1, c))}
      </div>
    );
  };

  return (
    <div className="thread_detail_page">
      <button className="thread_detail_back" onClick={() => navigate("/home")}>
        <ArrowLeftIcon /> back to forums
      </button>

      <div className="thread_detail_card" style={{ animation: "fade_in_up 0.4s ease" }}>
        <div className="thread_detail_type">{thread.type}</div>

        {editing ? (
          <div style={{ marginBottom: 16 }}>
            <div className="form_group">
              <label className="form_label">thread title</label>
              <input className="form_input" value={edit_form.title} onChange={(e) => set_edit_form({ ...edit_form, title: e.target.value })} />
            </div>
            <div className="form_group">
              <label className="form_label">reported user's name</label>
              <input className="form_input" value={edit_form.name} onChange={(e) => set_edit_form({ ...edit_form, name: e.target.value })} />
            </div>
            <div className="form_group">
              <label className="form_label">user id</label>
              <input className="form_input" value={edit_form.reported_id} onChange={(e) => set_edit_form({ ...edit_form, reported_id: e.target.value })} />
            </div>
            <div className="form_group">
              <label className="form_label">description</label>
              <textarea className="form_input" style={{ minHeight: 100 }} value={edit_form.description} onChange={(e) => set_edit_form({ ...edit_form, description: e.target.value })} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn_primary" style={{ width: "auto", padding: "10px 24px", fontSize: 14 }} onClick={save_edit}>save</button>
              <button className="btn_secondary" onClick={() => set_editing(false)}>cancel</button>
            </div>
          </div>
        ) : (
          <>
            {author_profile && (
              <div className="thread_author_row" onClick={() => navigate(`/user/${author_profile.user_id}`)} style={{ cursor: "pointer" }}>
                <img src={author_profile.avatar_url || "https://cdn.discordapp.com/embed/avatars/0.png"} alt="" className="comment_avatar" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 4 }}>
                    {author_profile.display_name || author_profile.username}
                    {app_config.owner_ids.includes(author_profile.user_id) && <CheckmarkIcon size={14} />}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>@{author_profile.username}</div>
                </div>
              </div>
            )}
            {thread.anonymous && <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>Posted anonymously</div>}
            <div className="thread_detail_title" style={{ fontSize: 24 }}>{thread.title || "Untitled Thread"}</div>
            <div className="thread_detail_title" style={{ fontSize: 16, color: "var(--text-muted)", marginBottom: 12 }}>{thread.name}</div>
            <div className="thread_detail_meta">
              <span className="thread_detail_meta_item">ID: {thread.reported_id}</span>
              <span className="thread_detail_meta_item">{time_ago(thread.created_at)}</span>
              <span className="thread_detail_meta_item" style={{ display: "flex", alignItems: "center", gap: 2 }}>
                {[...Array(5)].map((_, i) => (
                  <StarIcon key={i} filled={i < Math.round(avg_rating.average)} />
                ))}
                {avg_rating.count > 0 && <span style={{ marginLeft: 4 }}>{avg_rating.average.toFixed(1)} ({avg_rating.count})</span>}
              </span>
            </div>
            <div className="thread_detail_body">{parse_mentions(thread.description)}</div>
          </>
        )}

        {thread.attachments && thread.attachments.length > 0 && (
          <div className="thread_detail_attachments">
            {thread.attachments.map((a, i) =>
              a.content_type && a.content_type.startsWith("image/") ? (
                <img key={i} src={a.url} alt="" className="thread_detail_attach_img" onClick={() => set_lightbox(a.url)} />
              ) : a.content_type && a.content_type.startsWith("video/") ? (
                <video key={i} src={a.url} controls className="thread_detail_attach_img" style={{ maxHeight: 300 }} />
              ) : (
                <a key={i} href={a.url} target="_blank" rel="noreferrer" className="attachment_file_link">
                  📎 {a.name || `file ${i + 1}`}
                </a>
              )
            )}
          </div>
        )}

        <div className="thread_actions">
          <button className={`action_btn ${liked ? "liked" : ""}`} onClick={toggle_like}>
            <HeartIcon filled={liked} /> {like_count}
          </button>
          <div className="action_btn" style={{ cursor: "default" }}>
            <MessageIcon /> {comments.length}
          </div>
          {my_rating === 0 && (
            <div style={{ display: "flex", gap: 2, marginLeft: "auto" }}>
              {[1, 2, 3, 4, 5].map((v) => (
                <button key={v} className="star_btn" onClick={() => submit_rating(v)} title={`${v} stars`}>
                  <StarIcon filled={false} />
                </button>
              ))}
            </div>
          )}
          <div style={{ marginLeft: my_rating > 0 ? "auto" : 0, display: "flex", gap: 8 }}>
            {thread.status === "pending" && can_approve_decline && !editing && (
              <>
                <button className="action_btn" style={{ color: "var(--success)" }} onClick={() => update_status("approved")}>✓ approve</button>
                <button className="action_btn" style={{ color: "var(--warning)" }} onClick={() => update_status("declined")}>✕ decline</button>
              </>
            )}
            {can_edit && !editing && (
              <button className="action_btn" onClick={() => set_editing(true)}><EditIcon /> edit</button>
            )}
            {can_delete && !editing && (
              <button className="action_btn" style={{ color: "var(--danger)" }} onClick={delete_thread}><TrashIcon /> delete</button>
            )}
          </div>
        </div>
      </div>

      <div className="comments_section" style={{ animation: "fade_in_up 0.5s ease" }}>
        <div className="comments_title">Comments ({comments.length})</div>
        <div className="comment_input_wrap" style={{ position: "relative" }}>
          {reply_to && (
            <div className="reply_indicator">
              replying to <strong>{reply_to.username}</strong>
              <button onClick={() => set_reply_to(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", marginLeft: 8 }}>✕</button>
            </div>
          )}
          <input
            ref={comment_input_ref}
            className="comment_input"
            placeholder={reply_to ? `reply to ${reply_to.username}...` : "write a comment... use @username to mention"}
            value={comment_text}
            onChange={(e) => set_comment_text(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit_comment()}
          />
          <div ref={emoji_ref}>
            <button className="emoji_trigger" onClick={() => set_show_emoji(!show_emoji)} style={{ position: "absolute", right: 86, top: reply_to ? "calc(50% + 14px)" : "50%", transform: "translateY(-50%)" }}>😀</button>
            {show_emoji && (
              <div className="emoji_picker_wrap" style={{ bottom: 50, right: 80 }}>
                <EmojiPicker onEmojiClick={(e) => set_comment_text(prev => prev + e.emoji)} theme="dark" />
              </div>
            )}
          </div>
          <button className="comment_send_btn" onClick={submit_comment}>send</button>
        </div>
        {top_comments.map(c => render_comment(c))}
      </div>

      {lightbox && (
        <div className="image_lightbox" onClick={() => set_lightbox(null)}>
          <img src={lightbox} alt="" />
        </div>
      )}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      {mention_popup && <UserPopup username={mention_popup} close={() => set_mention_popup(null)} />}
    </div>
  );
}
