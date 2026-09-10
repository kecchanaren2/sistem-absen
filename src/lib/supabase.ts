import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; // Use service role for backend operations, public key for frontend

// Export two clients: one for public, one for admin tasks in the API
export const supabasePublic = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');
export const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
