import { describe, expect, it } from 'vitest';
import { isMissingPlacementColumnError } from '../services/placementPersistence.js';

describe('placementPersistence', () => {
  it('detects PostgREST missing column errors', () => {
    expect(
      isMissingPlacementColumnError(
        { message: "Could not find the 'image_url' column of 'placements' in the schema cache" },
        'image_url',
      ),
    ).toBe(true);
    expect(
      isMissingPlacementColumnError({ message: 'duplicate key value violates unique constraint' }, 'image_url'),
    ).toBe(false);
  });
});
