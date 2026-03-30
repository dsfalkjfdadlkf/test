import { createClient } from "@supabase/supabase-js";
import { app_config } from "./config";

export const supabase = createClient(app_config.supa_url, app_config.supa_service_role);
