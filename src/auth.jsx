import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "./supabase";
import { app_config } from "./config";

const auth_context = createContext(null);

export function use_auth() {
  return useContext(auth_context);
}

export function AuthProvider({ children }) {
  const [user, set_user] = useState(null);
  const [loading, set_loading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("expose_user");
    if (stored) {
      try {
        set_user(JSON.parse(stored));
      } catch (_) {}
    }
    set_loading(false);
  }, []);

  const login_with_discord = () => {
    const params = new URLSearchParams({
      client_id: app_config.client_id,
      redirect_uri: app_config.redirect_uri,
      response_type: "code",
      scope: "identify"
    });
    window.location.href = `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  };

  const handle_callback = async (code) => {
    const token_res = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: app_config.client_id,
        client_secret: app_config.client_secret,
        grant_type: "authorization_code",
        code,
        redirect_uri: app_config.redirect_uri,
        scope: "identify"
      })
    });
    const token_data = await token_res.json();
    if (!token_data.access_token) return null;

    const user_res = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${token_data.access_token}` }
    });
    const discord_user = await user_res.json();

    const avatar_url = discord_user.avatar
      ? `https://cdn.discordapp.com/avatars/${discord_user.id}/${discord_user.avatar}.png?size=256`
      : `https://cdn.discordapp.com/embed/avatars/${parseInt(discord_user.discriminator || "0") % 5}.png`;

    const { data: existing } = await supabase
      .from("web_profiles")
      .select("*")
      .eq("user_id", discord_user.id)
      .single();

    if (!existing) {
      await supabase.from("web_profiles").insert({
        user_id: discord_user.id,
        discord_id: discord_user.id,
        username: discord_user.username,
        display_name: discord_user.global_name || discord_user.username,
        avatar_url
      });
    } else {
      await supabase
        .from("web_profiles")
        .update({
          username: discord_user.username,
          avatar_url: existing.avatar_url || avatar_url
        })
        .eq("user_id", discord_user.id);
    }

    const { data: profile } = await supabase
      .from("web_profiles")
      .select("*")
      .eq("user_id", discord_user.id)
      .single();

    const user_obj = { ...profile, is_owner: app_config.owner_ids.includes(discord_user.id) };
    set_user(user_obj);
    localStorage.setItem("expose_user", JSON.stringify(user_obj));
    return user_obj;
  };

  const logout = () => {
    set_user(null);
    localStorage.removeItem("expose_user");
  };

  const refresh_profile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("web_profiles")
      .select("*")
      .eq("user_id", user.user_id)
      .single();
    if (data) {
      const updated = { ...data, is_owner: app_config.owner_ids.includes(data.user_id) };
      set_user(updated);
      localStorage.setItem("expose_user", JSON.stringify(updated));
    }
  };

  return (
    <auth_context.Provider value={{ user, loading, login_with_discord, handle_callback, logout, refresh_profile }}>
      {children}
    </auth_context.Provider>
  );
}
