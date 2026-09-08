CREATE TABLE public.recharges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  cpf TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  payment_method TEXT NOT NULL DEFAULT 'pix',
  transaction_id TEXT,
  pix_code TEXT,
  qr_code_base64 TEXT,
  pix_expires_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  blackcatpay_sale_id TEXT,
  metadata JSONB DEFAULT '{}',
  customer_name TEXT,
  customer_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.recharges ENABLE ROW LEVEL SECURITY;

-- All access goes through server functions using the admin (service-role) client.
-- The anon/auth roles have no direct access.
CREATE POLICY "No direct client access to recharges"
  ON public.recharges
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_recharges_updated_at
  BEFORE UPDATE ON public.recharges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_recharges_transaction_id ON public.recharges(transaction_id);
CREATE INDEX idx_recharges_status ON public.recharges(status);
CREATE INDEX idx_recharges_created_at ON public.recharges(created_at DESC);
CREATE INDEX idx_recharges_blackcatpay_sale_id ON public.recharges(blackcatpay_sale_id);