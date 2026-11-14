// Pointer positions are CSS pixels. Keep small thumb jitter out of movement packets.
export function joystickAxes(dx, dy, radius = 44) {
  if (![dx, dy, radius].every(Number.isFinite) || radius <= 0) return { right: 0, forward: 0 };
  const length = Math.hypot(dx, dy),
    amount = Math.min(1, length / radius),
    dead = 0.13;
  if (amount <= dead) return { right: 0, forward: 0 };
  const magnitude = (amount - dead) / (1 - dead);
  return { right: (dx / length) * magnitude, forward: (-dy / length) * magnitude };
}
