import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import WebSocket from "ws";
dotenv.config();

function isValidKey(k) {
  return Boolean(
    k &&
    typeof k === "string" &&
    !k.startsWith("your-") &&
    !k.includes("placeholder") &&
    k.trim().length > 20
  );
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const rawAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const supabaseServiceKey = isValidKey(rawServiceKey)
  ? rawServiceKey
  : (isValidKey(rawAnonKey) ? rawAnonKey : "");


export const isSupabaseServerConfigured = () => {
  return Boolean(
    supabaseUrl &&
    supabaseUrl.startsWith("https://") &&
    !supabaseUrl.includes("your-project-ref") &&
    isValidKey(supabaseServiceKey)
  );
};

export const supabaseServer = isSupabaseServerConfigured()
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      realtime: {
        transport: typeof globalThis.WebSocket !== "undefined" ? globalThis.WebSocket : WebSocket,
      },
    })
  : null;

export default supabaseServer;
