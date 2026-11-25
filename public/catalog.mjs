export const products = [
  { id: 'vestido-sol', category: 'Vestidos', name: 'Vestido Longo Poá', color: 'Terracota com poás claros', price: 39000, image: '/assets/vestido.jpg', source: 'https://www.instagram.com/estonadocarioca/p/DejtlCWzQE9/' },
  { id: 'vestido-risca-de-giz', category: 'Vestidos', name: 'Vestido Longo Risca de Giz', color: 'Preto', price: 39000, image: '/assets/vestido-risca-de-giz.jpg', source: 'https://www.instagram.com/estonadocarioca/p/DfXC40bTxqT/' },
  { id: 'vestido-botoes', category: 'Vestidos', name: 'Vestido Longo com Botões', color: 'Verde-claro', price: 39000, image: '/assets/vestido-botoes.jpg', source: 'https://www.instagram.com/estonadocarioca/p/DfCdZaKzBcM/' },
  { id: 'vestido-camadas', category: 'Vestidos', name: 'Vestido Longo em Camadas', color: 'Bege, off-white e areia', price: 39000, image: '/assets/vestido-camadas.jpg', source: 'https://www.instagram.com/estonadocarioca/p/DfCdWC7T-fq/' },
  { id: 'vestido-vitoria', category: 'Vestidos', name: 'Vestido Vitória Manga ¾', color: 'Marrom', price: 39000, image: '/assets/vestido-vitoria.jpg', source: 'https://www.instagram.com/estonadocarioca/reel/Dejt72UzDCY/' },
  { id: 'conjunto-saia', category: 'Conjuntos', name: 'Conjunto Saia em Camadas', color: 'Off-white e areia', price: 19000, image: '/assets/saia.jpg', source: 'https://www.instagram.com/estonadocarioca/p/DfCdWC7T-fq/' },
  { id: 'conjunto-short', category: 'Conjuntos', name: 'Conjunto Short Areia', color: 'Off-white', price: 19000, image: '/assets/short.jpg' },
  { id: 'conjunto-saia-roxo', category: 'Conjuntos', name: 'Conjunto Blusa e Saia Midi', color: 'Roxo', price: 19000, image: '/assets/conjunto-saia-roxo.jpg', source: 'https://www.instagram.com/estonadocarioca/p/DejtSrvzE_7/' },
  { id: 'macacao', category: 'Macacões', name: 'Macacão Fim de Tarde', color: 'Chocolate', price: 29000, image: '/assets/macacao.jpg' },
  { id: 'macacao-azul', category: 'Macacões', name: 'Macacão de Alças', color: 'Azul-marinho', price: 29000, image: '/assets/macacao-azul.jpg', source: 'https://www.instagram.com/estonadocarioca/p/DejthtOG6KY/' },
];

export const sizes = ['P', 'M', 'G'];
export const formatPrice = cents => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

export function readItems(lines) {
  if (!Array.isArray(lines) || lines.length > products.length * sizes.length) return [];
  const items = new Map();
  for (const line of lines) {
    const product = products.find(item => item.id === line?.id);
    if (!product || !sizes.includes(line.size) || !Number.isInteger(line.quantity) || line.quantity < 1) continue;
    const key = `${product.id}-${line.size}`;
    const quantity = Math.min(10, (items.get(key)?.quantity ?? 0) + line.quantity);
    items.set(key, { ...product, size: line.size, quantity, key });
  }
  return [...items.values()];
}
