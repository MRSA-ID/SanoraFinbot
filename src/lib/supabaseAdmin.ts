import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!;

// Digunakan khusus oleh Next.js Serverless Backend (Bypass RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
