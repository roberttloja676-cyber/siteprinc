# Estonado Carioca

Loja responsiva com catálogo, filtro de categorias, sacola e checkout em duas etapas. A compra é feita como visitante, com frete SEDEX gratuito e cartão de crédito em 1, 2 ou 3 parcelas. A sacola armazena apenas o código, tamanho e quantidade das peças no navegador.

## Prévia

Execute `node build.mjs` e depois `node preview.mjs`. A loja abre em http://127.0.0.1:4318.

O vestido poá e o conjunto de saia usam fotos publicadas no Instagram da loja. O conjunto de short, o macacão e a campanha do banner usam fotos ilustrativas. Os tamanhos P/M/G foram adotados para a prévia e precisam ser conferidos com o estoque. Para editar o catálogo, use `public/catalog.mjs` e `public/assets/`. O HTML do banner fica em `public/index.html`.

## Preparação para vender

1. Confirme a razão social, o CNPJ, o endereço e o telefone em `public/merchant.mjs` com o comprovante oficial. Confirme também a capacidade de cumprir o prazo estimado de 3 a 7 dias corridos após o pagamento, já com a preparação do pedido.
2. Confirme peças, fotos, disponibilidade, medidas, composição e cuidados. Atualize o catálogo com as características reais de cada peça e remova modelos ilustrativos que não estiverem à venda. Defina com o responsável pela loja as condições de troca comercial e a rotina de retenção e exclusão dos dados.
3. Na hospedagem com suporte a D1, aplique `support.sql` e vincule o banco privado como `SUPPORT_DB`. Verifique se uma solicitação feita em `/atendimento` aparece no banco com protocolo e horário. A equipe deve acompanhar as solicitações pelo painel privado do banco, responder dentro do prazo divulgado e tratar pedidos de arrependimento, cancelamento e estorno. A aplicação exibe o protocolo na hora e não envia e-mails automáticos.
4. Configure e valide a Pagar.me em ambiente de teste, seguindo os passos abaixo. Depois de conferir a operação, configure `STORE_OPERATIONS_READY=true` para permitir pagamentos no modo `live`.

## Pagar.me API v5

1. Cadastre o domínio onde o checkout será acessado na [Dashboard Pagar.me](https://dash.pagar.me/).
2. Registre `PAGARME_PUBLIC_KEY`, `PAGARME_SECRET_KEY`, `PAGARME_ACCOUNT_TYPE` (`gateway` ou `psp`) e `PAGARME_MODE=test` no ambiente do servidor. Use a chave pública `pk_test_…` e a secreta `sk_test_…` em teste. A chave secreta deve ficar no gerenciador de segredos da hospedagem.
3. Teste cartão aprovado, recusado e pagamento pendente, incluindo compras em duas e três parcelas, com suas chaves de sandbox. Confira se a conta habilita o parcelamento nas condições exibidas, se exige 3DS e se o endereço de cobrança é aceito no fluxo contratado. Acompanhe o pedido e seu status na Dashboard da Pagar.me antes de separar ou enviar a peça.
4. Para iniciar vendas, use as chaves de produção `pk_…` e `sk_…`, `PAGARME_MODE=live` e uma hospedagem HTTPS com o formulário de atendimento operacional.

O navegador envia os dados do cartão ao endpoint de tokenização da Pagar.me. O servidor recebe o token, valida o frete, o parcelamento e a versão dos termos, e recalcula os valores do catálogo com frete zero. A página permanece no mesmo domínio durante a compra. O cliente recebe a confirmação na tela e pode salvar uma cópia do comprovante e dos termos. A loja acompanha os estados do pedido na Dashboard da Pagar.me.

[Autenticação](https://docs.pagar.me/reference/autentica%C3%A7%C3%A3o-2) · [Tokenização](https://docs.pagar.me/reference/tokeniza%C3%A7%C3%A3o-1) · [Criar pedido](https://docs.pagar.me/reference/criar-pedido-2)

[Decreto nº 7.962/2013](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7962.htm) · [Código de Defesa do Consumidor](https://planalto.gov.br/ccivil_03/leis/l8078compilado.htm) · [LGPD](https://planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm)
