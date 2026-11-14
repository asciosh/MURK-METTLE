/** Avoid rebuilding unchanged text nodes or invalidating styles during HUD refresh. */
export function setText(element: Element, text: string): void {
  if (element.textContent !== text) element.textContent = text;
}
export function setWidth(element: HTMLElement, width: string): void {
  if (element.style.width !== width) element.style.width = width;
}
