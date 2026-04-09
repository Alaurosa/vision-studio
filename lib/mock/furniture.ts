import type { FurnitureItem } from '@types/index';

export const mockFurnitureCatalog: FurnitureItem[] = [
  {
    id: 'ikea-sofa-01',
    name: 'Stockholm Sofa',
    category: 'Seating',
    provider: 'IKEA',
    image: '🛋️',
    price: '$799',
    dimensions: '210 × 90 × 85 cm'
  },
  {
    id: 'ikea-table-01',
    name: 'Lack Coffee Table',
    category: 'Table',
    provider: 'IKEA',
    image: '☕',
    price: '$49',
    dimensions: '90 × 55 × 45 cm'
  },
  {
    id: 'ikea-chair-01',
    name: 'Poäng Armchair',
    category: 'Chair',
    provider: 'IKEA',
    image: '🪑',
    price: '$129',
    dimensions: '68 × 82 × 100 cm'
  }
];
