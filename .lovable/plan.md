## Causa raiz

Investiguei e isolei o problema. O símbolo AD não aparece porque a tag `<img>` está com `naturalWidth = 0` — ou seja, o arquivo da logo **não está sendo decodificado como imagem** no preview, apenas o texto "SCALE" renderiza.

Detalhes técnicos:
- O componente referencia a logo via `adLogoAsset.url` = `/__l5e/assets-v1/<id>/ad-logo.png` (Lovable Assets / CDN).
- Em produção (`adscalev1.lovable.app`) essa rota responde corretamente com `Content-Type: image/png` (754 KB).
- No dev server / preview do sandbox a mesma rota é interceptada pelo SPA fallback do Vite e retorna `Content-Type: text/html` (o `index.html`). O browser tenta decodificar HTML como imagem, falha silenciosamente e exibe largura 0 — exatamente o que o print mostra.
- Resultado: a logo "some" no preview que você está vendo, mesmo o asset existindo.

## Correção

Trocar o asset CDN por um arquivo importado diretamente (rota servida pelo Vite, não depende do `/__l5e/`):

1. **Salvar o PNG do símbolo AD em `src/assets/ad-logo.png`** como arquivo binário comum (não como `.asset.json`). Reutilizar a mesma arte azul atual baixando-a da CDN de produção que já funciona.
2. **Atualizar `src/components/AdScaleLogo.tsx`**:
   - Trocar `import adLogoAsset from "@/assets/ad-logo.png.asset.json"` por `import adLogoUrl from "@/assets/ad-logo.png"`.
   - Usar `src={adLogoUrl}` em vez de `adLogoAsset.url`.
3. **Atualizar `src/pages/Marketplace.tsx`** (linhas 41 e 311) para usar o mesmo import direto.
4. **Remover o pointer `src/assets/ad-logo.png.asset.json`** para evitar confusão futura.

Sem mudanças no layout/proporções definidas no último passo — apenas troca da origem do arquivo. Como passa a ser um import normal do Vite, funciona tanto no preview do sandbox quanto em produção, e o cache fica versionado pelo hash do build.

## Validação

Após a alteração, rodar Playwright em `http://localhost:8080/#/marketplace` e checar `header img → naturalWidth > 0` e capturar screenshot do header confirmando "AD + SCALE" visíveis lado a lado.
