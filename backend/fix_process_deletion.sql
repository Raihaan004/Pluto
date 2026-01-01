-- Run this in your Supabase SQL Editor to enable deletion of processes
drop policy if exists "Enable delete access for all users" on public.processes;
create policy "Enable delete access for all users"
on public.processes for delete
using ( true );
