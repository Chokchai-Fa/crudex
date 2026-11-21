function unsupported(): never {
  throw new Error('Native file search is unavailable in the agent runtime');
}

export {
  unsupported as close,
  unsupported as createPointer,
  unsupported as freePointer,
  unsupported as funcConstructor,
  unsupported as isNullPointer,
  unsupported as load,
  unsupported as open,
  unsupported as restorePointer,
  unsupported as unwrapPointer,
  unsupported as wrapPointer,
};

export const DataType = {};
export const PointerType = {};
