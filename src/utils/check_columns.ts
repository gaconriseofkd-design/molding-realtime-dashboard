import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  const { data, error } = await supabase.from('scan_logs').select('*').limit(1);
  if (error) {
    console.error('Error fetching scan_logs:', error);
    return;
  }
  if (data && data.length > 0) {
    console.log('Columns in scan_logs:', Object.keys(data[0]));
  } else {
    console.log('No data in scan_logs to check columns.');
  }
}

checkColumns();
