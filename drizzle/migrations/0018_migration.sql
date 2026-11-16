ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_related_transaction_id_fkey;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_related_transaction_id_fkey
  FOREIGN KEY (related_transaction_id) REFERENCES public.transactions(id) ON DELETE CASCADE;