import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { use_auth } from "../auth";

export default function CallbackPage() {
  const { handle_callback } = use_auth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    const code = params.get("code");
    if (code) {
      handle_callback(code).then((user) => {
        if (user) navigate("/home");
        else navigate("/");
      });
    } else {
      navigate("/");
    }
  }, []);

  return (
    <div className="splash_screen">
      <div className="loading_spinner">
        <div className="spinner" />
      </div>
    </div>
  );
}
