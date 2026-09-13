-- Выполните этот файл в Supabase SQL Editor для существующей базы MLF.
-- Хранит последнюю открытую пользователем книгу и главу Библии,
-- а также последнюю открытую главу отдельно для каждой книги.

alter table public.profiles
  add column if not exists last_bible_book_order smallint
    check (last_bible_book_order between 1 and 66),
  add column if not exists last_bible_chapter smallint
    check (last_bible_chapter >= 1),
  add column if not exists bible_chapter_positions jsonb not null default '{}'::jsonb
    check (jsonb_typeof(bible_chapter_positions) = 'object');

update public.profiles
set bible_chapter_positions = bible_chapter_positions || jsonb_build_object(
  last_bible_book_order::text,
  last_bible_chapter
)
where last_bible_book_order is not null
  and last_bible_chapter is not null;

create or replace function public.save_bible_reading_position(
  p_book_order smallint,
  p_chapter smallint
)
returns public.profiles
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  updated_profile public.profiles%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_book_order not between 1 and 66 or p_chapter < 1 then
    raise exception 'Invalid Bible chapter';
  end if;

  update public.profiles as profiles
  set
    last_bible_book_order = p_book_order,
    last_bible_chapter = p_chapter,
    bible_chapter_positions = jsonb_set(
      coalesce(profiles.bible_chapter_positions, '{}'::jsonb),
      array[p_book_order::text],
      to_jsonb(p_chapter),
      true
    )
  where profiles.id = current_user_id
  returning profiles.* into updated_profile;

  if not found then
    raise exception 'Profile not found';
  end if;

  return updated_profile;
end;
$$;

revoke all on function public.save_bible_reading_position(smallint, smallint) from public;
grant execute on function public.save_bible_reading_position(smallint, smallint) to authenticated;
