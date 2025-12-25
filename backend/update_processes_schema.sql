-- Add status column to processes table
ALTER TABLE public.processes 
ADD COLUMN IF NOT EXISTS status text not null default 'published';
