-- Fix the existing bad record for Júlio: ad_spend should be 2000, commission should be 6% = 120
UPDATE commissions 
SET ad_spend = 2000, 
    amount = 120, 
    valor_pendente = 120, 
    percentual_aplicado = 6,
    status = 'pendente'
WHERE id = 'f83ae8e2-a147-434d-b631-1916c7299c28';