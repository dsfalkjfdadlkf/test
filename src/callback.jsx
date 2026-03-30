import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { use_auth } from "../auth";

export default function CallbackPage() {
    const { handle_callback } = use_auth();
    const navigate = useNavigate();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");

        if (code) {
            handle_callback(code).then(() => {
                navigate("/home");
            }).catch(() => {
                navigate("/");
            });
        } else {
            navigate("/");
        }
    }, [handle_callback, navigate]);

    return (
        <div className="loading_spinner">
            <div className="spinner" />
            <p>Logging you in...</p>
        </div>
    );
}
