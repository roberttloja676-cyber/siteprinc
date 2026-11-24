import { readItems } from './public/catalog.mjs';
import { sedex, termsVersion, installmentOptions } from './public/merchant.mjs';

const api = 'https://api.pagar.me/core/v5';
const states = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
const attemptFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self' https://api.pagar.me; form-action 'self'; base-uri 'none'; object-src 'none'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff'
};
const json = (data, status = 200) => Response.json(data, {
  status,
  headers: { ...securityHeaders, 'Cache-Control': 'no-store' }
});
const problem = (message, status, retryWithNewAttempt = false) => json({ message, retryWithNewAttempt }, status);
const clean = (value, max) => typeof value === 'string' && value.trim().length <= max ? value.trim() : '';
const digits = (value, max) => clean(value, max).replace(/\D/g, '');

function config(env) {
  const publicKey = env.PAGARME_PUBLIC_KEY ?? '';
  const secretKey = env.PAGARME_SECRET_KEY ?? '';
  const type = env.PAGARME_ACCOUNT_TYPE;
  const mode = env.PAGARME_MODE;
  if (!['gateway', 'psp'].includes(type) || !['test', 'live'].includes(mode)) return null;
  const isTest = mode === 'test';
  if (!isTest && (env.STORE_OPERATIONS_READY !== 'true' || !env.SUPPORT_DB?.prepare)) return null;
  if (!/^(pk_)[a-zA-Z0-9_]+$/.test(publicKey) || !/^(sk_)[a-zA-Z0-9_]+$/.test(secretKey) ||
      publicKey.startsWith('pk_test_') !== isTest || secretKey.startsWith('sk_test_') !== isTest) return null;
  return { publicKey, secretKey, type, mode };
}

function normalizeAddress(data) {
  const zip = digits(data?.zip, 9);
  const state = clean(data?.state, 2);
  const city = clean(data?.city, 60);
  const number = clean(data?.number, 15);
  const street = clean(data?.street, 75);
  const neighborhood = clean(data?.neighborhood, 55);
  if (!/^\d{8}$/.test(zip) || !city || !states.has(state) || !number || !street || !neighborhood) return null;
  return {
    zip_code: zip, city, state, country: 'BR',
    line_1: `${number}, ${street}, ${neighborhood}`,
    line_2: clean(data?.complement, 50)
  };
}

function normalizeCustomer(data, address) {
  const name = clean(data?.name, 64);
  const email = clean(data?.email, 64).toLowerCase();
  const document = digits(data?.document, 14);
  const phone = digits(data?.phone, 20);
  const nationalPhone = phone.length === 13 && phone.startsWith('55') ? phone.slice(2) : phone;
  if (name.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !/^\d{11}$/.test(document) || !/^[1-9]\d{10}$/.test(nationalPhone)) return null;
  return {
    name, email, document, document_type: 'CPF', type: 'individual', address,
    phones: { mobile_phone: { country_code: '55', area_code: nationalPhone.slice(0, 2), number: nationalPhone.slice(2) } }
  };
}

async function pagarme(path, data, key, settings, send) {
  const response = await send(api + path, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(settings.secretKey + ':')}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': key
    },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) throw Object.assign(new Error('Pagar.me'), { status: response.status });
  return result;
}

async function readSubmission(request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return problem('Origem inválida.', 403);
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || '')) return problem('Formato inválido.', 415);
  if (Number(request.headers.get('content-length')) > 8192) return problem('Envio muito grande.', 413);
  const reader = request.body?.getReader();
  if (!reader) return problem('Envio inválido.', 400);
  const decoder = new TextDecoder();
  let input = '';
  let bytes = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 8192) { await reader.cancel(); return problem('Envio muito grande.', 413); }
    input += decoder.decode(value, { stream: true });
  }
  try { return JSON.parse(input + decoder.decode()); }
  catch { return problem('Envio inválido.', 400); }
}

export async function createOrder(request, env, send = fetch) {
  const settings = config(env);
  if (!settings) return problem('O pagamento está indisponível nesta prévia.', 503);
  const data = await readSubmission(request);
  if (data instanceof Response) return data;
  const key = clean(data?.attempt, 36);
  const token = clean(data?.cardToken, 128);
  const lines = readItems(data?.items);
  const shipping = normalizeAddress(data?.address);
  const billing = normalizeAddress(data?.billing);
  const customer = shipping && normalizeCustomer(data?.customer, shipping);
  const installments = data?.installments;
  if (data?.shippingMethod !== sedex.id || !installmentOptions.includes(installments)) {
    return problem('Selecione o frete SEDEX e de uma a três parcelas no cartão.', 400);
  }
  if (data?.acceptedTerms !== true || data?.termsVersion !== termsVersion) {
    return problem('Atualize a página e confira os termos da compra antes de pagar.', 400);
  }
  if (!attemptFormat.test(key) || !/^token_[a-zA-Z0-9]+$/.test(token) || !lines.length || !shipping || !billing || !customer) {
    return problem('Confira a sacola, o CPF, o celular com DDD e os dados do endereço.', 400);
  }

  const items = lines.map(line => ({ code: line.key, description: `${line.name} · ${line.size}`, amount: line.price, quantity: line.quantity }));
  const total = items.reduce((sum, item) => sum + item.amount * item.quantity, 0);
  const phone = customer.phones.mobile_phone;
  const credit = { installments, operation_type: 'auth_and_capture', statement_descriptor: 'ESTONADO' };
  let payer = { customer };
  let sendingOrder = false;
  try {
    if (settings.type === 'psp') {
      const registered = await pagarme('/customers', customer, key + '-customer', settings, send);
      if (!/^cus_[a-zA-Z0-9]+$/.test(registered.id)) throw new Error('Cliente indisponível');
      const card = await pagarme(`/customers/${registered.id}/cards`, { token, billing_address: billing }, key + '-card', settings, send);
      if (!/^card_[a-zA-Z0-9]+$/.test(card.id)) throw new Error('Cartão indisponível');
      payer = { customer_id: registered.id };
      credit.card_id = card.id;
    } else {
      credit.card_token = token;
      credit.card = { billing_address: billing };
    }
    sendingOrder = true;
    const order = await pagarme('/orders', {
      code: key,
      closed: true,
      ...payer,
      items,
      metadata: { terms_version: termsVersion, shipping_method: sedex.id, shipping_deadline: sedex.deadline },
      shipping: {
        amount: sedex.amount,
        description: sedex.name + ' – frete grátis',
        recipient_name: customer.name,
        recipient_phone: phone.country_code + phone.area_code + phone.number,
        address: shipping
      },
      payments: [{ payment_method: 'credit_card', amount: total, credit_card: credit }]
    }, key, settings, send);
    const status = typeof order.status === 'string' ? order.status.toLowerCase() : '';
    if (status === 'failed' || status === 'canceled') return problem('O cartão não foi aprovado. Você pode tentar outro cartão.', 402, true);
    if (!/^or_[a-zA-Z0-9]+$/.test(order.id) || !['paid', 'pending'].includes(status) || order.amount !== total) {
      return problem('O pagamento está em verificação. Consulte a loja antes de fazer outro pedido.', 502);
    }
    return json({ id: order.id, status });
  } catch (error) {
    if (error.status === 409) return problem('A tentativa ainda está em processamento. Aguarde e tente novamente nesta aba.', 409);
    if ([400, 412, 422].includes(error.status)) {
      return problem('A Pagar.me não aceitou os dados. Confira o cartão e o endereço de cobrança.', 422, !sendingOrder);
    }
    return problem('A confirmação não chegou. Tente novamente nesta aba para consultar a mesma tentativa.', 502);
  }
}

export async function createSupportRequest(request, database) {
  if (!database?.prepare) return problem('O formulário está indisponível no momento. Use o telefone da loja.', 503);
  const payload = await readSubmission(request);
  if (payload instanceof Response) return payload;
  const email = clean(payload?.email, 150);
  const topic = payload?.topic;
  const order = clean(payload?.order, 52);
  const message = clean(payload?.message, 2000);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !message ||
      !['duvida', 'entrega', 'troca', 'arrependimento', 'cancelamento', 'reclamacao', 'privacidade'].includes(topic)) {
    return problem('Confira o assunto, o e-mail e a mensagem.', 400);
  }
  const protocol = crypto.randomUUID();
  try {
    await database.prepare('INSERT INTO support_requests (id, email, topic, order_reference, message) VALUES (?, ?, ?, ?, ?)')
      .bind(protocol, email, topic, order, message).run();
    return json({ protocol }, 201);
  } catch {
    return problem('Não foi possível registrar a solicitação. Tente novamente ou use o telefone da loja.', 503);
  }
}

export function serve(assets) {
  return {
    async fetch(request, env = {}) {
      const path = new URL(request.url).pathname;
      if (path === '/api/orders' && request.method === 'POST') return createOrder(request, env);
      if (path === '/api/support' && request.method === 'POST') return createSupportRequest(request, env.SUPPORT_DB);
      if (path === '/api/checkout-config' && request.method === 'GET') {
        const settings = config(env);
        const payment = settings ? { publicKey: settings.publicKey, mode: settings.mode } : { publicKey: null };
        return json({ ...payment, supportAvailable: Boolean(env.SUPPORT_DB?.prepare) });
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') return problem('Método indisponível.', 405);
      const entry = Object.hasOwn(assets, path) ? assets[path] : null;
      if (!entry) return new Response('Página não encontrada.', { status: 404, headers: securityHeaders });
      const [type, contents] = entry;
      const body = type.startsWith('image/') ? Uint8Array.from(atob(contents), character => character.charCodeAt(0)) : contents;
      return new Response(request.method === 'HEAD' ? null : body, {
        headers: {
          ...securityHeaders,
          'Content-Type': type,
          'Cache-Control': type.startsWith('image/') ? 'public, max-age=3600' : 'no-cache'
        }
      });
    }
  };
}
