export const products = [
  { id: 'vestido-sol', category: 'Vestidos', name: 'Vestido Longo Poá', color: 'Terracota com poás claros', price: 39000, image: '/assets/vestido.jpg', source: 'https://www.instagram.com/estonadocarioca/p/DejtlCWzQE9/' },
  { id: 'conjunto-saia', category: 'Conjuntos', name: 'Conjunto Saia em Camadas', color: 'Off-white e areia', price: 19000, image: '/assets/saia.jpg', source: 'https://www.instagram.com/estonadocarioca/p/DfCdWC7T-fq/' },
  { id: 'conjunto-short', category: 'Conjuntos', name: 'Conjunto Short Areia', color: 'Off-white', price: 19000, image: '/assets/short.jpg' },
  { id: 'macacao', category: 'Macacões', name: 'Macacão Fim de Tarde', color: 'Chocolate', price: 29000, image: '/assets/macacao.jpg' },
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
