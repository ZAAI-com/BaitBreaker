// src/content/dom-manipulator.js
export function insertIndicator(afterNode, data) {
  const indicator = document.createElement('span');
  indicator.className = 'bb-indicator';
  indicator.textContent = '[B]';
  indicator.dataset.confidence = String(data.confidence ?? 0);
  indicator.dataset.href = afterNode.href || '';
  afterNode.insertAdjacentElement('afterend', indicator);
  return indicator;
}
