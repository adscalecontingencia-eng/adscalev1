-- 1) has_role must not be callable by anonymous visitors
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;

-- 2) order_deliveries: hide the credential payload behind column-level grants
REVOKE SELECT ON public.order_deliveries FROM authenticated;
GRANT SELECT (id, order_id, order_item_id, product_id, delivery_mode, delivered_at, created_at)
  ON public.order_deliveries TO authenticated;
GRANT ALL ON public.order_deliveries TO service_role;

-- 3) Controlled accessor for the payload (ownership / staff check inside)
CREATE OR REPLACE FUNCTION public.get_order_delivery_payload(_delivery_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload jsonb;
  v_ok boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT d.payload,
         public.has_role(auth.uid(), 'admin'::public.app_role)
         OR public.has_role(auth.uid(), 'support'::public.app_role)
         OR EXISTS (
           SELECT 1 FROM public.orders o
           JOIN public.clients c ON c.id = o.client_id
           WHERE o.id = d.order_id AND c.auth_user_id = auth.uid()
         )
    INTO v_payload, v_ok
  FROM public.order_deliveries d
  WHERE d.id = _delivery_id;

  IF NOT COALESCE(v_ok, false) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE(v_payload, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_order_delivery_payload(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_order_delivery_payload(uuid) TO authenticated, service_role;