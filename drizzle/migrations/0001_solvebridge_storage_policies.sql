
create policy "Read media of published problems" on storage.objects for select to anon, authenticated
  using (bucket_id = 'problem-media' and exists (select 1 from public.problem_media m where m.file_path = storage.objects.name));

create policy "Read media of visible solutions" on storage.objects for select to anon, authenticated
  using (bucket_id = 'solution-media' and exists (select 1 from public.solution_media m where m.file_path = storage.objects.name));

create policy "Solvers upload own solution media" on storage.objects for insert to authenticated
  with check (bucket_id = 'solution-media' and (storage.foldername(name))[1] = auth.uid()::text);

grant insert on public.solution_media to authenticated;
create policy "Solvers attach media to own solutions" on public.solution_media for insert to authenticated
  with check (exists (select 1 from public.solutions s where s.id = solution_id and s.submitted_by = auth.uid())
    and split_part(file_path, '/', 1) = auth.uid()::text);
