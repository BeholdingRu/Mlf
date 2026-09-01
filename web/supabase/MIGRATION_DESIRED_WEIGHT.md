# Миграция: Добавление желаемого веса

## Описание изменений

Добавлено новое поле `desired_weight` в таблицу `profiles` для хранения желаемого веса пользователя.

## Применение миграции

Выполните SQL-запрос в редакторе SQL вашего проекта Supabase:

```sql
-- Добавляем поле desired_weight (желаемый вес) в таблицу profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS desired_weight numeric(6, 1);
```

Или выполните скрипт:
```bash
psql -h <your-supabase-host> -U postgres -d postgres -f web/supabase/add_desired_weight.sql
```

## Откат миграции (при необходимости)

```sql
ALTER TABLE public.profiles
DROP COLUMN IF EXISTS desired_weight;
```

## Связанные файлы

- `web/supabase/add_desired_weight.sql` - SQL миграция
- `web/src/lib/types.ts` - обновлен тип Profile
- `web/src/context/DataContext.tsx` - добавлена функция saveDesiredWeight
- `web/src/components/SettingsModal.tsx` - добавлено поле ввода желаемого веса
- `web/src/components/WeightChart.tsx` - добавлен расчет и отображение прогресса
