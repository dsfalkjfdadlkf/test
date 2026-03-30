import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { app_config } from "../config";
import { use_auth } from "../auth";
import { UploadIcon, EmojiIcon } from "../icons";
import EmojiPicker from "emoji-picker-react";

export default function CreatePage() {
  const { user } = use_auth();
  const file_ref = useRef(null);
  const emoji_ref = useRef(null);
  const [types, set_types] = useState([]);
  const [form, set_form] = useState({
    title: "",
    name: "",
    reported_id: "",
    description: "",
    type: "",
    custom_type: "",
    anonymous: false
  });
  const [files, set_files] = useState([]);
  const [submitting, set_submitting] = useState(false);
  const [toast, set_toast] = useState(null);
  const [dropdown_open, set_dropdown_open] = useState(false);
  const [show_emoji, set_show_emoji] = useState(false);

  useEffect(() => {
    load_types();
    const handle_click = (e) => {
      if (emoji_ref.current && !emoji_ref.current.contains(e.target)) {
        set_show_emoji(false);
      }
    };
    document.addEventListener("mousedown", handle_click);
    return () => document.removeEventListener("mousedown", handle_click);
  }, []);

  const load_types = async () => {
    const { data } = await supabase
      .from("report_types")
      .select("name")
      .eq("server_id", app_config.server_id);
    if (data) set_types(data.map((t) => t.name));
  };

  const show_toast = (msg, type = "success") => {
    set_toast({ msg, type });
    setTimeout(() => set_toast(null), 3000);
  };

  const handle_files = (e) => {
    const new_files = Array.from(e.target.files);
    set_files((prev) => [...prev, ...new_files].slice(0, 20));
  };

  const remove_file = (idx) => {
    set_files((prev) => prev.filter((_, i) => i !== idx));
  };

  const generate_report_id = () => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `RPT-${timestamp}-${random}`.toUpperCase();
  };

  const upload_file = async (file) => {
    const ext = file.name.split(".").pop();
    const path = `reports/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { data, error } = await supabase.storage.from("attachments").upload(path, file);
    if (error) return null;
    const { data: url_data } = supabase.storage.from("attachments").getPublicUrl(path);
    return {
      url: url_data.publicUrl,
      name: file.name,
      content_type: file.type,
      size: file.size
    };
  };

  const handle_submit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.name || !form.reported_id || !form.description || !form.type) {
      show_toast("please fill in all required fields", "error");
      return;
    }

    const last_submit = localStorage.getItem("last_report_submit");
    if (last_submit) {
      const diff = Date.now() - parseInt(last_submit);
      const remaining = Math.ceil((300000 - diff) / 1000);
      if (diff < 300000) {
        show_toast(`cooldown active — wait ${Math.floor(remaining / 60)}m ${remaining % 60}s`, "error");
        return;
      }
    }

    set_submitting(true);

    let final_type = form.type;
    if (form.type === "other" && form.custom_type.trim()) {
      final_type = form.custom_type.trim().toLowerCase();
    }

    const attachments = [];
    for (const file of files) {
      const uploaded = await upload_file(file);
      if (uploaded) attachments.push(uploaded);
    }

    const report_id = generate_report_id();
    const report = {
      report_id,
      title: form.title,
      name: form.name,
      reported_id: form.reported_id,
      description: form.description,
      type: final_type,
      attachments,
      anonymous: form.anonymous,
      submitted_by_id: user.user_id,
      submitted_by_tag: user.username,
      status: "pending",
      server_id: app_config.server_id
    };

    const { error } = await supabase.from("reports").insert([report]);

    if (error) {
      console.error("Submission error:", error);
      show_toast(`failed to submit: ${error.message}`, "error");
      set_submitting(false);
      return;
    }

    show_toast(`report ${report_id} submitted successfully`);
    localStorage.setItem("last_report_submit", Date.now().toString());
    set_form({ title: "", name: "", reported_id: "", description: "", type: "", custom_type: "", anonymous: false });
    set_files([]);
    set_submitting(false);
  };

  return (
    <>
      <div className="page_header">
        <h1>Create Report</h1>
        <div className="page_header_sub">submit a new report for review</div>
      </div>
      <div className="create_page">
        <form onSubmit={handle_submit}>
          <div className="form_group">
            <label className="form_label">thread title</label>
            <input
              className="form_input"
              placeholder="e.g. exposing this scammer"
              value={form.title}
              onChange={(e) => set_form({ ...form, title: e.target.value })}
            />
          </div>

          <div className="form_group">
            <label className="form_label">reported user's name</label>
            <input
              className="form_input"
              placeholder="e.g. username123"
              value={form.name}
              onChange={(e) => set_form({ ...form, name: e.target.value })}
            />
          </div>

          <div className="form_group">
            <label className="form_label">reported user's discord id</label>
            <input
              className="form_input"
              placeholder="e.g. 123456789012345678"
              value={form.reported_id}
              onChange={(e) => set_form({ ...form, reported_id: e.target.value })}
            />
          </div>

          <div className="form_group">
            <label className="form_label">report type</label>
            <div className="custom_select_wrap" style={{ position: "relative" }}>
              <div 
                className={`form_input ${dropdown_open ? "dropdown_active" : ""}`} 
                onClick={() => set_dropdown_open(!dropdown_open)}
                style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                {form.type ? form.type.charAt(0).toUpperCase() + form.type.slice(1) : "select a type..."}
                <svg width="12" height="12" fill="#666" viewBox="0 0 16 16"><path d="M8 11L3 6h10z"/></svg>
              </div>
              {dropdown_open && (
                <div className="custom_dropdown_menu">
                  {(types.length > 0 ? types : ["other", "pedophile", "skid", "scammer", "doxxer"]).map((t) => (
                    <div 
                      key={t} 
                      className="custom_dropdown_item"
                      onClick={() => {
                        set_form({ ...form, type: t });
                        set_dropdown_open(false);
                      }}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {form.type === "other" && (
            <div className="form_group" style={{ animation: "fade_in_up 0.3s ease" }}>
              <label className="form_label">custom type</label>
              <input
                className="form_input"
                placeholder="enter custom report type..."
                value={form.custom_type}
                onChange={(e) => set_form({ ...form, custom_type: e.target.value })}
              />
            </div>
          )}

          <div className="form_group">
            <label className="form_label">description</label>
            <div style={{ position: "relative" }} ref={emoji_ref}>
              <textarea
                className="form_input"
                style={{ minHeight: "140px", paddingBottom: "40px", resize: "vertical" }}
                placeholder="describe what happened in detail..."
                value={form.description}
                onChange={(e) => set_form({ ...form, description: e.target.value })}
              />
              <button 
                type="button" 
                className="btn_secondary" 
                style={{ position: "absolute", bottom: 12, right: 12, padding: "4px 8px" }} 
                onClick={(e) => { e.preventDefault(); set_show_emoji(!show_emoji); }}
              >
                <EmojiIcon />
              </button>
              {show_emoji && (
                <div style={{ position: "absolute", bottom: "100%", right: 0, zIndex: 50, marginBottom: 8 }}>
                  <EmojiPicker 
                    theme="dark" 
                    onEmojiClick={(e) => { set_form({ ...form, description: form.description + e.emoji }); set_show_emoji(false); }} 
                  />
                </div>
              )}
            </div>
          </div>

          <div className="form_group">
            <div className="form_switch_row">
              <div>
                <div className="form_switch_label">Anonymous Mode</div>
                <div className="form_switch_desc">your identity will be hidden from the report</div>
              </div>
              <button
                type="button"
                className={`toggle_switch ${form.anonymous ? "on" : ""}`}
                onClick={() => set_form({ ...form, anonymous: !form.anonymous })}
              />
            </div>
          </div>

          <div className="form_group">
            <label className="form_label">attachments (up to 20)</label>
            <div
              className="attachments_area"
              onClick={() => file_ref.current?.click()}
            >
              <UploadIcon />
              <div className="attachments_area_text">
                click to upload images or videos
              </div>
              <div className="attachments_area_text" style={{ fontSize: 12, marginTop: 4 }}>
                {files.length}/20 files selected
              </div>
            </div>
            <input
              ref={file_ref}
              type="file"
              multiple
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip,.rar"
              style={{ display: "none" }}
              onChange={handle_files}
            />
            {files.length > 0 && (
              <div className="attachments_preview">
                {files.map((f, i) => (
                  <div key={i} className="attachment_thumb_wrap">
                    {f.type.startsWith("image/") ? (
                      <img src={URL.createObjectURL(f)} alt="" className="attachment_thumb" />
                    ) : (
                      <div className="attachment_thumb" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-tertiary)", fontSize: 10, color: "var(--text-muted)" }}>
                        {f.name.split(".").pop()}
                      </div>
                    )}
                    <button type="button" className="attachment_remove" onClick={() => remove_file(i)}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button type="submit" className="btn_primary" disabled={submitting}>
            {submitting ? "submitting..." : "submit report"}
          </button>
        </form>
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  );
}
