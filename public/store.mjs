import { products, sizes, formatPrice, readItems } from './catalog.mjs';
import { merchant, sedex, termsVersion, installmentOptions } from './merchant.mjs';

const storageKey = 'estonado-carioca-bag';
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const digits = value => value.replace(/\D/g, '');
const amount = items => items.reduce((total, item) => total + item.price * item.quantity, 0);
const stored = () => {
  try { return readItems(JSON.parse(localStorage.getItem(storageKey))); }
  catch { return []; }
};
let bag = stored();
const serialize = () => bag.map(({ id, size, quantity }) => ({ id, size, quantity }));

function saveBag(items) {
  bag = readItems(items);
  try { localStorage.setItem(storageKey, JSON.stringify(serialize())); }
  catch { /* The current page can still show the bag. */ }
}

function summary(items) {
  const total = formatPrice(amount(items));
  return `<div class="summary"><div><span>Subtotal</span><span>${total}</span></div><div><span>Entrega SEDEX</span><span class="free">Grátis</span></div><div><span>Total</span><span>${total}</span></div></div>`;
}

function showMerchant() {
  for (const target of $$('[data-merchant]')) {
    const identity = document.createElement('p');
    const address = document.createElement('p');
    const phone = document.createElement('a');
    identity.textContent = `${merchant.name} · CNPJ ${merchant.cnpj}`;
    address.textContent = merchant.address;
    phone.href = `tel:${merchant.telephone}`;
    phone.textContent = merchant.phone;
    target.append(identity, address, phone);
  }
}

async function checkoutConfig() {
  try {
    const response = await fetch('/api/checkout-config', { cache: 'no-store' });
    if (response.ok) return await response.json();
  } catch { /* Preview and connection failures leave payment disabled. */ }
  return {};
}

function itemRows(items, editable) {
  return items.map(item => `<div class="line">
    <img src="${item.image}" alt="" width="64" height="64">
    <div><strong>${item.name}</strong><p>Tamanho ${item.size}${editable ? '' : ` · ${item.quantity} un.`}</p>
    ${editable ? `<div class="quantity">
      <button type="button" data-line="${item.key}" data-delta="-1" aria-label="Diminuir quantidade de ${item.name} tamanho ${item.size}">−</button>
      <span>${item.quantity}</span>
      <button type="button" data-line="${item.key}" data-delta="1" aria-label="Aumentar quantidade de ${item.name} tamanho ${item.size}" ${item.quantity >= 10 ? 'disabled' : ''}>+</button>
    </div>` : ''}</div>
    <strong>${formatPrice(item.price * item.quantity)}</strong>
  </div>`).join('');
}

function setupStore() {
  const dialog = $('#bag');
  function renderBag() {
    $('#bag-count').textContent = bag.reduce((total, item) => total + item.quantity, 0);
    $('#bag-items').innerHTML = bag.length ? itemRows(bag, true) : '<p>Sua sacola está vazia.</p>';
    $('#bag-summary').innerHTML = bag.length ? `${summary(bag)}<a class="button" href="/checkout">Finalizar pedido</a>` : '';
  }

  function renderProducts(category) {
    for (const filter of $$('[data-filter]')) filter.setAttribute('aria-pressed', filter.dataset.filter === category);
    const visible = category === 'Todos' ? products : products.filter(product => product.category === category);
    $('#products').innerHTML = visible.map(product => `<article class="product">
      <img src="${product.image}" alt="${product.name} em ${product.color}" width="627" height="627" loading="lazy">
      <h3>${product.name}</h3><p>${product.color}</p>
      ${product.description ? `<p>${product.description}</p>` : ''}
      <p class="photo-note">${product.source ? `<a href="${product.source}" target="_blank" rel="noopener">Foto do Instagram</a>` : 'Foto ilustrativa'}</p>
      <p class="price">${formatPrice(product.price)}</p>
      <form data-product="${product.id}">
        <select aria-label="Tamanho de ${product.name}" name="size" required>
          <option value="">Tamanho</option>${sizes.map(size => `<option>${size}</option>`).join('')}
        </select>
        <button class="button">Adicionar</button>
      </form>
    </article>`).join('');
  }

  for (const filter of $$('[data-filter]')) filter.addEventListener('click', () => renderProducts(filter.dataset.filter));
  for (const link of $$('[data-select]')) link.addEventListener('click', () => renderProducts(link.dataset.select));

  $('#products').addEventListener('submit', event => {
    event.preventDefault();
    const form = event.target;
    const { product: id } = form.dataset;
    const { value: size } = form.elements.size;
    const lines = serialize();
    const existing = lines.find(line => line.id === id && line.size === size);
    if (existing) existing.quantity += 1;
    else lines.push({ id, size, quantity: 1 });
    saveBag(lines);
    renderBag();
    $('#announcement').textContent = 'Sacola atualizada.';
    dialog.showModal();
  });
  $('#bag-items').addEventListener('click', event => {
    const button = event.target.closest('[data-line]');
    if (!button) return;
    const { line: key, delta } = button.dataset;
    saveBag(bag.map(item => item.key === key ? { ...item, quantity: item.quantity + Number(delta) } : item));
    renderBag();
    (document.querySelector(`[data-line="${key}"][data-delta="${delta}"]:not(:disabled)`) ??
      document.querySelector(`[data-line="${key}"]:not(:disabled)`) ?? $('.close')).focus();
  });
  $('#open-bag').addEventListener('click', () => dialog.showModal());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left) dialog.close();
  });
  window.addEventListener('pageshow', () => { bag = stored(); renderBag(); });
  window.addEventListener('storage', event => {
    if (event.key === storageKey) { bag = stored(); renderBag(); }
  });
  renderProducts('Todos');
  renderBag();
}

const stateList = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const opts = stateList.map(state => `<option>${state}</option>`).join('');

function addressFields(prefix = '') {
  return `<label>CEP<input name="${prefix}zip" pattern="[0-9]{5}-?[0-9]{3}" inputmode="numeric" maxlength="9" required></label>
    <label>Número<input name="${prefix}number" maxlength="15" required></label>
    <label class="full">Rua ou avenida<input name="${prefix}street" maxlength="75" required></label>
    <label>Bairro<input name="${prefix}neighborhood" maxlength="55" required></label>
    <label>Complemento <small>opcional</small><input name="${prefix}complement" maxlength="50"></label>
    <label>Cidade<input name="${prefix}city" maxlength="60" required></label>
    <label>UF<select name="${prefix}state" required><option value="">Selecione</option>${opts}</select></label>`;
}

async function tokenize(publicKey) {
  const number = digits($('#card-number').value);
  const expiry = digits($('#expiry').value);
  const cvv = digits($('#cvv').value);
  const month = Number(expiry.slice(0, 2));
  const year = Number(expiry.slice(2));
  const now = new Date();
  if (number.length < 13 || number.length > 19 || expiry.length !== 4 || month < 1 || month > 12 ||
      new Date(2000 + year, month, 1) <= now || !/^\d{3,4}$/.test(cvv) || $('#holder').value.trim().length < 3) {
    throw new Error('Confira o número, a validade e o código de segurança do cartão.');
  }
  const response = await fetch(`https://api.pagar.me/core/v5/tokens?appId=${encodeURIComponent(publicKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'card',
      card: { number, holder_name: $('#holder').value.trim(), exp_month: month, exp_year: year, cvv }
    }),
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json();
  if (!response.ok || typeof result.id !== 'string' || !result.id.startsWith('token_')) {
    throw new Error('A Pagar.me não conseguiu validar o cartão. Confira os dados e tente novamente.');
  }
  return result.id;
}

function readAddress(data, prefix = '') {
  return Object.fromEntries(['zip', 'number', 'street', 'neighborhood', 'complement', 'city', 'state'].map(
    field => [field, data.get(prefix + field)?.trim() ?? '']
  ));
}

async function setupCheckout() {
  if (!bag.length) { $('#checkout-empty').hidden = false; return; }
  const layout = $('#checkout-layout');
  const form = $('#checkout-form');
  const cardFields = $('#card-fields');
  const pay = $('#pay');
  const message = $('#checkout-message');
  const differentBilling = $('#different-billing');
  const deliveryStep = $('#delivery-step');
  const paymentStep = $('#payment-step');
  const review = $('#delivery-review');
  const installmentsField = $('#installments');
  let publicKey;
  let mode;
  let attempt;
  let contractText = '';
  try { attempt = JSON.parse(sessionStorage.getItem('estonado-attempt')); }
  catch { /* An empty or unavailable session starts with the current bag. */ }
  let submitting = false;
  $('#checkout-items').innerHTML = itemRows(bag, false);
  $('#checkout-total').innerHTML = summary(bag);
  $('#states').insertAdjacentHTML('beforeend', opts);
  $('#shipping-deadline').textContent = `Prazo estimado de ${sedex.deadline}.`;
  installmentsField.replaceChildren(...installmentOptions.map(count => {
    const total = amount(bag);
    const approx = total % count ? 'cerca de ' : '';
    const label = `${count}× de ${approx}${formatPrice(Math.round(total / count))} · total ${formatPrice(total)}`;
    return new Option(label, String(count));
  }));
  differentBilling.addEventListener('change', () => {
    const fields = $('#billing-fields');
    fields.hidden = !differentBilling.checked;
    fields.innerHTML = differentBilling.checked ? addressFields('billing-') : '';
  });
  $('#expiry').addEventListener('input', event => {
    const value = digits(event.target.value).slice(0, 4);
    event.target.value = value.length > 2 ? `${value.slice(0, 2)}/${value.slice(2)}` : value;
  });
  layout.hidden = false;
  function setStep(payment) {
    deliveryStep.hidden = payment;
    paymentStep.hidden = !payment;
    $('#delivery-label').toggleAttribute('aria-current', !payment);
    $('#payment-label').toggleAttribute('aria-current', payment);
    (payment ? $('#payment-label') : $('#delivery-label')).setAttribute('aria-current', 'step');
    pay.disabled = !payment || !publicKey;
    (payment ? $('#review-heading') : form.elements.name).focus();
  }
  $('#continue-to-payment').addEventListener('click', () => {
    const invalid = deliveryStep.querySelector('input:invalid, select:invalid');
    if (invalid) { invalid.reportValidity(); return; }
    const data = new FormData(form);
    const address = readAddress(data);
    review.textContent = [
      data.get('email'), `${address.street}, ${address.number}`, address.complement,
      `${address.neighborhood}, ${address.city} – ${address.state}, CEP ${address.zip}`,
      `${sedex.name} grátis · ${sedex.deadline}`
    ].filter(Boolean).join(' · ');
    setStep(true);
  });
  $('#edit-delivery').addEventListener('click', () => {
    form.elements.terms.checked = false;
    setStep(false);
  });
  ({ publicKey, mode } = await checkoutConfig());
  cardFields.disabled = !publicKey;
  pay.disabled = paymentStep.hidden || !publicKey;
  message.textContent = !publicKey ? 'Prévia da loja. O pagamento está desativado.' :
    mode === 'test' ? 'Ambiente de teste. Use apenas dados de teste da Pagar.me.' : '';
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting || paymentStep.hidden || !publicKey) return;
    const items = serialize();
    const cart = JSON.stringify(items);
    const data = new FormData(form);
    const installments = Number(data.get('installments'));
    const shippingMethod = data.get('shippingMethod');
    const retryWindow = mode === 'test' ? 4 * 60 * 1000 : 23 * 60 * 60 * 1000;
    if (attempt && (Date.now() - attempt.started >= retryWindow || attempt.cart !== cart ||
      attempt.mode !== mode || attempt.installments !== installments)) {
      message.textContent = `Consulte a loja sobre a tentativa ${attempt.id} antes de fazer outro pedido.`;
      message.focus();
      return;
    }
    submitting = true;
    pay.disabled = true;
    message.textContent = 'Processando o pagamento…';
    const address = readAddress(data);
    const billing = differentBilling.checked ? readAddress(data, 'billing-') : address;
    let submittedOrder = false;
    try {
      if (!contractText) {
        const policy = await fetch('/atendimento', { signal: AbortSignal.timeout(10000) });
        if (!policy.ok) throw new Error('As condições da compra estão indisponíveis. Tente novamente.');
        const page = new DOMParser().parseFromString(await policy.text(), 'text/html');
        contractText = page.querySelector('#purchase-terms').textContent.trim().split('\n').map(line => line.trim()).filter(Boolean).join('\n\n');
      }
      const cardToken = await tokenize(publicKey);
      for (const selector of ['#holder', '#card-number', '#expiry', '#cvv']) $(selector).value = '';
      attempt ||= { id: crypto.randomUUID(), started: Date.now(), cart, mode, installments };
      sessionStorage.setItem('estonado-attempt', JSON.stringify(attempt));
      submittedOrder = true;
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attempt: attempt.id, cardToken, items, address, billing, installments, shippingMethod,
          acceptedTerms: data.get('terms') === 'on', termsVersion,
          customer: Object.fromEntries(['name', 'email', 'document', 'phone'].map(field => [field, data.get(field)]))
        }),
        signal: AbortSignal.timeout(55000)
      });
      const result = await response.json();
      if (!response.ok || result.status === 'failed') {
        if (result.retryWithNewAttempt) { attempt = null; sessionStorage.removeItem('estonado-attempt'); }
        throw new Error(result.message || 'Não foi possível concluir o pedido. Tente novamente.');
      }
      sessionStorage.removeItem('estonado-attempt');
      const copy = [
        'Estonado Carioca – Comprovante e condições da compra',
        `${merchant.name} · CNPJ ${merchant.cnpj}\n${merchant.address}\nAtendimento ${merchant.phone}`,
        `Pedido ${result.id}\n${result.status === 'paid' ? 'Pagamento aprovado' : 'Aguardando confirmação do pagamento'}`,
        bag.map(item => `${item.quantity} × ${item.name} (tamanho ${item.size}) · ${formatPrice(item.price * item.quantity)}`).join('\n'),
        `Total ${formatPrice(amount(bag))} em ${installments}× no cartão\n${review.textContent}`,
        `Termos de compra e uso · versão ${termsVersion}\n\n${contractText}`
      ].join('\n\n');
      saveBag([]);
      form.reset();
      layout.hidden = true;
      const resultPanel = $('#checkout-result');
      const heading = document.createElement('h2');
      heading.textContent = result.status === 'paid' ? 'Pagamento aprovado' : 'Pedido recebido';
      const detail = document.createElement('p');
      detail.textContent = result.status === 'paid' ? `Pedido ${result.id} confirmado.` : `Pedido ${result.id} aguardando confirmação da Pagar.me.`;
      const download = document.createElement('a');
      download.className = 'button';
      download.href = URL.createObjectURL(new Blob([copy], { type: 'text/plain;charset=utf-8' }));
      download.download = `pedido-${result.id}.txt`;
      download.textContent = 'Baixar comprovante e termos';
      resultPanel.append(heading, detail, download);
      resultPanel.hidden = false;
      resultPanel.focus();
    } catch (error) {
      message.textContent = error.name === 'TimeoutError' || error.name === 'TypeError' || error.name === 'SyntaxError'
        ? (submittedOrder ? 'A confirmação não chegou. Tente novamente nesta aba para consultar a mesma tentativa.' : 'Não foi possível conectar à Pagar.me. Tente novamente.')
        : error.message;
      message.focus();
    } finally {
      submitting = false;
      pay.disabled = false;
    }
  });
}

async function setupSupport() {
  const form = $('#support-form');
  const button = $('#send-support');
  const message = $('#support-status');
  for (const link of $$('[data-topic]')) {
    link.addEventListener('click', () => { $('#support-topic').value = link.dataset.topic; });
  }
  const { supportAvailable } = await checkoutConfig();
  if (!supportAvailable) {
    message.textContent = `O formulário está indisponível nesta prévia. Use o telefone ${merchant.phone}.`;
    return;
  }
  button.disabled = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    button.disabled = true;
    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
        signal: AbortSignal.timeout(15000)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      form.reset();
      message.textContent = `Solicitação recebida. Protocolo ${result.protocol}.`;
    } catch (error) {
      message.textContent = error instanceof TypeError || error.name === 'TimeoutError'
        ? 'Não foi possível enviar. Tente novamente ou use o telefone da loja.'
        : error.message;
    } finally {
      button.disabled = false;
      message.focus();
    }
  });
}

showMerchant();
if (document.body.dataset.page === 'store') setupStore();
else if (document.body.dataset.page === 'checkout') setupCheckout();
else setupSupport();
