import { createClient } from '@supabase/supabase-js';

// Credentials loaded from Vercel environment variables (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
// Fallback: ERP Supabase (djwjmfgplnqyffdcgdaw) - same project after migration
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "https://djwjmfgplnqyffdcgdaw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqd2ptZmdwbG5xeWZmZGNnZGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjU2OTcsImV4cCI6MjA4ODY0MTY5N30.pi2HDGyXhsoZS0sivfUDzn9z3Qao-6hMKrWBxoQ-1uE";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);