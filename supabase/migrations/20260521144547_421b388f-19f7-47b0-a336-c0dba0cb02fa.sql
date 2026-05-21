ALTER TABLE public.meta_page_assignments
  ADD CONSTRAINT meta_page_assignments_page_id_fkey
  FOREIGN KEY (page_id) REFERENCES public.meta_pages(id) ON DELETE CASCADE;

ALTER TABLE public.meta_page_assignments
  ADD CONSTRAINT meta_page_assignments_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;