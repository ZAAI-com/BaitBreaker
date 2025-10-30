// src/content/tooltip-manager.js
export class TooltipManager {
  constructor() {
    this.currentTooltip = null;
    this.loadingTooltip = null;
  }

  showLoading(element) {
    this.hideTooltip();
    const tooltip = document.createElement('div');
    tooltip.className = 'bb-tooltip bb-loading';
    tooltip.innerHTML = `
      <div class="bb-spinner"></div>
      <p>Analyzing article...</p>
    `;
    this.positionTooltip(tooltip, element);
    document.body.appendChild(tooltip);
    this.loadingTooltip = tooltip;
  }

  showSummary(element, summary, metadata) {
    this.hideTooltip();
    const tooltip = document.createElement('div');
    tooltip.className = 'bb-tooltip';
    tooltip.innerHTML = `
      <div class="bb-header">
        <h4>Quick Answer</h4>
        <span class="bb-close">×</span>
      </div>
      <div class="bb-content">
        <p class="bb-summary">${this.escapeHtml(summary)}</p>
        <div class="bb-metadata">
          <span class="bb-source">${metadata.domain}</span>
          <span class="bb-confidence">Confidence: ${metadata.confidence}%</span>
        </div>
      </div>
    `;
    this.positionTooltip(tooltip, element);
    document.body.appendChild(tooltip);
    this.currentTooltip = tooltip;
    tooltip.querySelector('.bb-close').addEventListener('click', () => this.hideTooltip());
  }

  hideTooltip() {
    if (this.currentTooltip?.parentNode) this.currentTooltip.remove();
    if (this.loadingTooltip?.parentNode) this.loadingTooltip.remove();
    this.currentTooltip = null;
    this.loadingTooltip = null;
  }

  positionTooltip(tooltip, anchor) {
    const rect = anchor.getBoundingClientRect();
    const tooltipWidth = 320;
    let left = rect.left;
    let top = rect.bottom + 10;
    if (left + tooltipWidth > window.innerWidth) {
      left = window.innerWidth - tooltipWidth - 10;
    }
    if (top + 200 > window.innerHeight) {
      top = rect.top - 210;
    }
    tooltip.style.position = 'absolute';
    tooltip.style.left = `${left + window.scrollX}px`;
    tooltip.style.top = `${top + window.scrollY}px`;
  }

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
