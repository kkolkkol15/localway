create or replace function public.review_tour_change_request(
  p_request_id uuid,
  p_decision text,
  p_reason text default ''
)
returns public.tour_change_requests
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_request public.tour_change_requests%rowtype;
  v_main_image_path text;
begin
  if v_user_id is null or not private.is_admin() then
    raise exception 'Admin privileges are required';
  end if;

  select *
  into v_request
  from public.tour_change_requests
  where id = p_request_id
    and status = 'pending'
  for update;

  if not found then
    raise exception 'Pending tour change request not found';
  end if;

  if p_decision = 'approved' then
    update public.tours
    set title = coalesce(v_request.payload->>'title', title),
        city = coalesce(v_request.payload->>'city', city),
        type = coalesce(v_request.payload->>'type', type),
        description = coalesce(v_request.payload->>'description', description),
        content_html = coalesce(v_request.payload->>'content_html', content_html),
        price_amount = coalesce((v_request.payload->>'price_amount')::integer, price_amount),
        currency = coalesce(v_request.payload->>'currency', currency),
        payment_type = coalesce(v_request.payload->>'payment_type', payment_type),
        duration_minutes = coalesce((v_request.payload->>'duration_minutes')::integer, duration_minutes),
        max_people = coalesce((v_request.payload->>'max_people')::integer, max_people),
        options = coalesce(v_request.payload->'options', options),
        status = 'active'
    where id = v_request.tour_id;

    v_main_image_path := nullif(v_request.payload->>'main_image_path', '');

    if v_main_image_path is not null then
      delete from public.tour_images
      where tour_id = v_request.tour_id;

      insert into public.tour_images (tour_id, image_path, sort_order)
      values (v_request.tour_id, v_main_image_path, 0);
    end if;

    update public.tour_change_requests
    set status = 'approved',
        reviewed_by = v_user_id,
        reviewed_at = now(),
        rejection_reason = null
    where id = p_request_id
    returning * into v_request;
  elsif p_decision = 'rejected' then
    update public.tours
    set status = 'active'
    where id = v_request.tour_id;

    update public.tour_change_requests
    set status = 'rejected',
        reviewed_by = v_user_id,
        reviewed_at = now(),
        rejection_reason = nullif(p_reason, '')
    where id = p_request_id
    returning * into v_request;
  else
    raise exception 'Decision must be approved or rejected';
  end if;

  return v_request;
end;
$$;

revoke all on function public.review_tour_change_request(uuid, text, text) from public;
revoke all on function public.review_tour_change_request(uuid, text, text) from anon;
grant execute on function public.review_tour_change_request(uuid, text, text) to authenticated;

revoke all on function public.submit_tour_change_request(uuid, jsonb) from anon;
grant execute on function public.submit_tour_change_request(uuid, jsonb) to authenticated;
