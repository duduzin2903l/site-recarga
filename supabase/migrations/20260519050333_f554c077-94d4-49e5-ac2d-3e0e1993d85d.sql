
CREATE TABLE public.gateway_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'blackcatpay',
  api_key TEXT,
  secret_key TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.gateway_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct client access to gateway_settings"
  ON public.gateway_settings FOR ALL TO public
  USING (false) WITH CHECK (false);

INSERT INTO public.gateway_settings (provider) VALUES ('blackcatpay');
