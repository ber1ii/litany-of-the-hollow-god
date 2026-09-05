type TileChangeListener = (x: number, z: number, oldId: number, newId: number) => void;

class TileEventBus {
  private listeners = new Set<TileChangeListener>();

  subscribe(fn: TileChangeListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(x: number, z: number, oldId: number, newId: number): void {
    for (const fn of this.listeners) fn(x, z, oldId, newId);
  }
}

export const tileEventBus = new TileEventBus();
