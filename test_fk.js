import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nxwuetedozatxfoaaqzl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54d3VldGVkb3phdHhmb2FhcXpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NzA1NTQsImV4cCI6MjA4OTI0NjU1NH0.pKWeDzbmcZvhsrH9q02NQI-jdyf5zeJVysNmLYiveHk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDeleteAction() {
  const { data, error } = await supabase.rpc('get_foreign_keys');
  if (error) {
     // fallback if rpc not available
     console.log("no rpc, try raw query somehow");
  } else {
     console.log(data);
  }
}
checkDeleteAction();
