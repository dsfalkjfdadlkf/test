import { EyeIcon, DiscordIcon } from "../icons";
import { use_auth } from "../auth";

export default function SplashPage() {
  const { login_with_discord } = use_auth();

  return (
    <div className="splash_screen">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32, animation: "fade_in 0.8s ease" }}>
        <div className="splash_logo" style={{ color: "#dc2626" }}>
          <EyeIcon size={120} />
        </div>
        <div className="splash_title">Expose Center Forums</div>
        <div className="splash_continue">
          <button className="btn_discord" onClick={login_with_discord}>
            <DiscordIcon />
            Login with Discord
          </button>
        </div>
      </div>
    </div>
  );
}
