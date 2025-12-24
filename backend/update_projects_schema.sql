-- Run this in your Supabase SQL Editor to add the missing column
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS collaborators jsonb not null default '[]'::jsonb;
