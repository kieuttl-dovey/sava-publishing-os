-- SAVA Publishing OS v0.29
-- Complete audit coverage for editable business data + playbook rules + source file replacement.
-- Safe to run once on the existing Supabase project.

begin;

-- 1) Make the generic audit trigger work for tables whose primary key is `id`
--    as well as config tables whose primary key is `key`.
create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  payload jsonb;
  rid text;
begin
  payload := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  rid := coalesce(payload ->> 'id', payload ->> 'key', payload ->> 'email', '');

  if tg_op = 'DELETE' then
    insert into public.audit_logs(table_name, record_id, action, actor_id, old_data, new_data)
    values (tg_table_name, nullif(rid,''), tg_op, auth.uid(), to_jsonb(old), null);
    return old;
  elsif tg_op = 'UPDATE' then
    -- Do not create a log when nothing material changed.
    if (to_jsonb(old) - 'updated_at' - 'updated_by')
       is distinct from
       (to_jsonb(new) - 'updated_at' - 'updated_by') then
      insert into public.audit_logs(table_name, record_id, action, actor_id, old_data, new_data)
      values (tg_table_name, nullif(rid,''), tg_op, auth.uid(), to_jsonb(old), to_jsonb(new));
    end if;
    return new;
  else
    insert into public.audit_logs(table_name, record_id, action, actor_id, old_data, new_data)
    values (tg_table_name, nullif(rid,''), tg_op, auth.uid(), null, to_jsonb(new));
    return new;
  end if;
end;
$$;

-- 2) Existing business-table triggers already call write_audit_log().
--    Add the two editable areas that were not fully covered before.
drop trigger if exists trg_playbook_configs_audit on public.playbook_configs;
create trigger trg_playbook_configs_audit
after insert or update or delete on public.playbook_configs
for each row execute function public.write_audit_log();

drop trigger if exists trg_profiles_audit on public.profiles;
create trigger trg_profiles_audit
after insert or update or delete on public.profiles
for each row execute function public.write_audit_log();

-- 3) Storage changes are not table-row changes, so the frontend calls this RPC
--    after an Admin uploads/replaces a source workbook.
create or replace function public.log_app_activity(
  p_table_name text,
  p_record_id text,
  p_action text,
  p_new_data jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if public.current_app_role() <> 'admin' then
    raise exception 'Admin role required';
  end if;

  insert into public.audit_logs(table_name, record_id, action, actor_id, old_data, new_data)
  values (
    coalesce(nullif(trim(p_table_name),''),'app_activity'),
    nullif(trim(coalesce(p_record_id,'')),''),
    upper(coalesce(nullif(trim(p_action),''),'UPDATE')),
    auth.uid(),
    null,
    coalesce(p_new_data,'{}'::jsonb)
  );
end;
$$;

revoke all on function public.log_app_activity(text,text,text,jsonb) from public;
grant execute on function public.log_app_activity(text,text,text,jsonb) to authenticated;

commit;
