-- Run this in your Supabase SQL Editor to add the status column to projects
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS status text default 'draft';
