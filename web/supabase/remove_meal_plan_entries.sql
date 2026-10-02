-- Run once in the Supabase SQL editor to permanently remove the food planner.
-- This deletes the planner table and all meal-plan entries stored in it.
drop table if exists public.meal_plan_entries cascade;
