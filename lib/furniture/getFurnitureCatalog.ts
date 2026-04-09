import { mockFurnitureCatalog } from '@lib/mock/furniture';
import type { FurnitureItem } from '@types/index';

export function getFurnitureCatalog(): Promise<FurnitureItem[]> {
  // TODO: Load furniture catalog from provider APIs or backend services.
  return Promise.resolve(mockFurnitureCatalog);
}
