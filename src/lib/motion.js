// Shared motion: one easing curve and one spring, so every animation in Flow feels like the same family.
export const ease = [0.22, 1, 0.36, 1];
export const spring = { type: 'spring', stiffness: 260, damping: 32, mass: 0.9 };
export const soft = { duration: 0.45, ease };
export const quick = { duration: 0.22, ease };
