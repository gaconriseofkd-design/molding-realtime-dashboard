import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nxwuetedozatxfoaaqzl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54d3VldGVkb3phdHhmb2FhcXpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NzA1NTQsImV4cCI6MjA4OTI0NjU1NH0.pKWeDzbmcZvhsrH9q02NQI-jdyf5zeJVysNmLYiveHk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  const shelves = [];
  for (let i = 1; i <= 20; i++) {
    const id = `SHELF-${String(i).padStart(2, '0')}`;
    const name = `Kệ ${String(i).padStart(2, '0')}`;
    shelves.push({
      id,
      name,
      max_molds: 9999,
      status: 'optimal',
      operational_status: 'active'
    });
  }

  console.log('Seeding shelves into Supabase machines table...');
  const { data, error } = await supabase
    .from('machines')
    .upsert(shelves, { onConflict: 'id' });

  if (error) {
    console.error('Seeding failed:', error.message);
  } else {
    console.log('Seeding completed successfully! Seeded 20 shelves.');
  }
}

seed();
