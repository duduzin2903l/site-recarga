UPDATE public.recharges
SET transaction_id = COALESCE(metadata->'data'->>'transactionId', metadata->>'transactionId'),
    blackcatpay_sale_id = COALESCE(blackcatpay_sale_id, metadata->'data'->>'transactionId', metadata->>'transactionId')
WHERE transaction_id IS NULL
  AND metadata IS NOT NULL;