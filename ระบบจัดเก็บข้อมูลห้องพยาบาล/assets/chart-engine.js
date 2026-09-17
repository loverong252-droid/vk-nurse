/**
 * Pure SVG Offline Chart Engine
 * ออกแบบสำหรับระบบห้องพยาบาล ทำงานแบบ Offline 100% ไม่ต้องต่อเน็ต
 */

class HospitalChartEngine {
  constructor() {
    this.tooltip = this.getOrCreateTooltip();
  }

  getOrCreateTooltip() {
    let tip = document.getElementById('chartTooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'chartTooltip';
      tip.className = 'chart-tooltip';
      document.body.appendChild(tip);
    }
    return tip;
  }

  showTooltip(e, text) {
    this.tooltip.innerHTML = text;
    this.tooltip.style.opacity = '1';
    this.tooltip.style.left = (e.pageX + 12) + 'px';
    this.tooltip.style.top = (e.pageY - 28) + 'px';
  }

  hideTooltip() {
    this.tooltip.style.opacity = '0';
  }

  /**
   * Bar Chart
   * @param {string} containerId 
   * @param {Array<{label: string, value: number, color?: string}>} data 
   * @param {Object} options 
   */
  renderBarChart(containerId, data, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (!data || data.length === 0 || data.every(d => d.value === 0)) {
      container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:220px;color:#94a3b8;font-size:0.95rem;">ยังไม่มีข้อมูลสถิติในช่วงเวลานี้</div>`;
      return;
    }

    const width = container.clientWidth || 500;
    const height = options.height || 260;
    const padding = { top: 25, right: 20, bottom: 45, left: 45 };

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const maxValue = Math.max(...data.map(d => d.value), 5);
    // Y-axis grid step
    const ySteps = 4;
    const yGridStep = Math.ceil(maxValue / ySteps);
    const adjustedMax = yGridStep * ySteps;

    let svg = `<svg class="svg-chart" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;

    // Horizontal grid lines
    for (let i = 0; i <= ySteps; i++) {
      const yVal = Math.round(yGridStep * i);
      const yPos = padding.top + chartHeight - (yVal / adjustedMax) * chartHeight;
      svg += `
        <line x1="${padding.left}" y1="${yPos}" x2="${width - padding.right}" y2="${yPos}" class="chart-axis-line" stroke-dasharray="${i === 0 ? 'none' : '3,3'}" />
        <text x="${padding.left - 8}" y="${yPos + 4}" class="chart-axis-text" style="text-anchor: end;">${yVal}</text>
      `;
    }

    // Bars
    const totalBars = data.length;
    const slotWidth = chartWidth / totalBars;
    const barWidth = Math.min(Math.max(slotWidth * 0.55, 16), 48);

    data.forEach((item, index) => {
      const barHeight = (item.value / adjustedMax) * chartHeight;
      const x = padding.left + (index * slotWidth) + (slotWidth - barWidth) / 2;
      const y = padding.top + chartHeight - barHeight;
      const color = item.color || '#1d4ed8';

      svg += `
        <g class="chart-bar-group" data-label="${item.label}" data-value="${item.value}">
          <rect class="chart-bar" x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4" fill="${color}" />
          <text x="${x + barWidth / 2}" y="${y - 6}" class="chart-axis-text" style="font-weight: bold; fill: #1e293b;">${item.value > 0 ? item.value : ''}</text>
          <text x="${x + barWidth / 2}" y="${height - padding.bottom + 20}" class="chart-axis-text" transform="rotate(${totalBars > 8 ? '-30' : '0'}, ${x + barWidth / 2}, ${height - padding.bottom + 20})">${item.label}</text>
        </g>
      `;
    });

    svg += `</svg>`;
    container.innerHTML = svg;

    // Attach hover events
    const barGroups = container.querySelectorAll('.chart-bar-group');
    barGroups.forEach(g => {
      g.addEventListener('mouseenter', (e) => {
        const label = g.getAttribute('data-label');
        const val = g.getAttribute('data-value');
        this.showTooltip(e, `<strong>${label}</strong>: ${val} ครั้ง`);
      });
      g.addEventListener('mousemove', (e) => {
        const label = g.getAttribute('data-label');
        const val = g.getAttribute('data-value');
        this.showTooltip(e, `<strong>${label}</strong>: ${val} ครั้ง`);
      });
      g.addEventListener('mouseleave', () => this.hideTooltip());
    });
  }

  /**
   * Donut Chart with Legend
   * @param {string} containerId 
   * @param {Array<{label: string, value: number, color: string}>} data 
   */
  renderDonutChart(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const validData = data.filter(d => d.value > 0);
    const total = validData.reduce((sum, d) => sum + d.value, 0);

    if (total === 0) {
      container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:220px;color:#94a3b8;font-size:0.95rem;">ยังไม่มีข้อมูลสถิติ</div>`;
      return;
    }

    const size = 200;
    const strokeWidth = 32;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    let accumulatedAngle = 0;

    let circlesSvg = '';
    validData.forEach(item => {
      const slicePercentage = item.value / total;
      const strokeDashoffset = circumference * (1 - slicePercentage);
      const rotation = (accumulatedAngle * 360) - 90;

      circlesSvg += `
        <circle class="donut-slice"
          cx="${size / 2}" cy="${size / 2}" r="${radius}"
          fill="transparent"
          stroke="${item.color}"
          stroke-width="${strokeWidth}"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="${strokeDashoffset}"
          transform="rotate(${rotation} ${size / 2} ${size / 2})"
          data-label="${item.label}" data-value="${item.value}" data-pct="${Math.round(slicePercentage * 100)}%"
          style="transition: stroke-width 0.2s ease; cursor: pointer;"
        />
      `;
      accumulatedAngle += slicePercentage;
    });

    let legendHtml = `<div class="chart-legend">`;
    validData.forEach(item => {
      const pct = Math.round((item.value / total) * 100);
      legendHtml += `
        <div class="legend-item">
          <div class="legend-left">
            <span class="legend-color" style="background:${item.color};"></span>
            <span>${item.label}</span>
          </div>
          <div>
            <strong>${item.value}</strong> <span style="color:#64748b;font-size:0.8rem;">(${pct}%)</span>
          </div>
        </div>
      `;
    });
    legendHtml += `</div>`;

    const html = `
      <div class="chart-flex-container">
        <div style="position: relative; width: ${size}px; height: ${size}px; margin: 0 auto;">
          <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            ${circlesSvg}
            <circle cx="${size/2}" cy="${size/2}" r="${radius - strokeWidth/2 + 2}" fill="#ffffff" />
            <text x="${size / 2}" y="${size / 2 - 4}" text-anchor="middle" font-size="20" font-weight="bold" fill="#1e293b">${total}</text>
            <text x="${size / 2}" y="${size / 2 + 16}" text-anchor="middle" font-size="12" fill="#64748b">คน/ครั้ง</text>
          </svg>
        </div>
        ${legendHtml}
      </div>
    `;

    container.innerHTML = html;

    // Hover events on slices
    const slices = container.querySelectorAll('.donut-slice');
    slices.forEach(sl => {
      sl.addEventListener('mouseenter', (e) => {
        sl.setAttribute('stroke-width', strokeWidth + 6);
        const label = sl.getAttribute('data-label');
        const val = sl.getAttribute('data-value');
        const pct = sl.getAttribute('data-pct');
        this.showTooltip(e, `<strong>${label}</strong>: ${val} ราย (${pct})`);
      });
      sl.addEventListener('mousemove', (e) => {
        const label = sl.getAttribute('data-label');
        const val = sl.getAttribute('data-value');
        const pct = sl.getAttribute('data-pct');
        this.showTooltip(e, `<strong>${label}</strong>: ${val} ราย (${pct})`);
      });
      sl.addEventListener('mouseleave', () => {
        sl.setAttribute('stroke-width', strokeWidth);
        this.hideTooltip();
      });
    });
  }

  /**
   * Line / Area Chart for Trends
   * @param {string} containerId 
   * @param {Array<{label: string, value: number}>} data 
   */
  renderLineChart(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (!data || data.length === 0 || data.every(d => d.value === 0)) {
      container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:220px;color:#94a3b8;font-size:0.95rem;">ยังไม่มีข้อมูลแนวโน้มสถิติ</div>`;
      return;
    }

    const width = container.clientWidth || 550;
    const height = 260;
    const padding = { top: 25, right: 25, bottom: 45, left: 45 };

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const maxValue = Math.max(...data.map(d => d.value), 4);
    const ySteps = 4;
    const yGridStep = Math.ceil(maxValue / ySteps);
    const adjustedMax = yGridStep * ySteps;

    let svg = `<svg class="svg-chart" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;

    // Defs for gradient
    svg += `
      <defs>
        <linearGradient id="lineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#1d4ed8" stop-opacity="0.35" />
          <stop offset="100%" stop-color="#1d4ed8" stop-opacity="0.0" />
        </linearGradient>
      </defs>
    `;

    // Y Grid lines
    for (let i = 0; i <= ySteps; i++) {
      const yVal = Math.round(yGridStep * i);
      const yPos = padding.top + chartHeight - (yVal / adjustedMax) * chartHeight;
      svg += `
        <line x1="${padding.left}" y1="${yPos}" x2="${width - padding.right}" y2="${yPos}" class="chart-axis-line" stroke-dasharray="${i === 0 ? 'none' : '3,3'}" />
        <text x="${padding.left - 8}" y="${yPos + 4}" class="chart-axis-text" style="text-anchor: end;">${yVal}</text>
      `;
    }

    // Points calculation
    const stepX = chartWidth / (data.length - 1 || 1);
    const points = data.map((d, idx) => {
      const x = padding.left + (idx * stepX);
      const y = padding.top + chartHeight - (d.value / adjustedMax) * chartHeight;
      return { x, y, label: d.label, value: d.value };
    });

    // Area Path
    let areaPath = `M ${points[0].x} ${points[0].y}`;
    points.forEach((p, idx) => {
      if (idx > 0) areaPath += ` L ${p.x} ${p.y}`;
    });
    areaPath += ` L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;

    svg += `<path d="${areaPath}" fill="url(#lineGrad)" />`;

    // Line Path
    let linePath = `M ${points[0].x} ${points[0].y}`;
    points.forEach((p, idx) => {
      if (idx > 0) linePath += ` L ${p.x} ${p.y}`;
    });
    svg += `<path d="${linePath}" fill="none" stroke="#1d4ed8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />`;

    // Dots and Labels
    points.forEach(p => {
      svg += `
        <g class="chart-point-group" data-label="${p.label}" data-value="${p.value}">
          <circle cx="${p.x}" cy="${p.y}" r="5" fill="#ffffff" stroke="#1d4ed8" stroke-width="2.5" style="cursor:pointer;" />
          <text x="${p.x}" y="${height - padding.bottom + 20}" class="chart-axis-text">${p.label}</text>
        </g>
      `;
    });

    svg += `</svg>`;
    container.innerHTML = svg;

    // Hover events on points
    const pointGroups = container.querySelectorAll('.chart-point-group');
    pointGroups.forEach(g => {
      g.addEventListener('mouseenter', (e) => {
        const label = g.getAttribute('data-label');
        const val = g.getAttribute('data-value');
        this.showTooltip(e, `<strong>${label}</strong>: ${val} ครั้ง`);
      });
      g.addEventListener('mousemove', (e) => {
        const label = g.getAttribute('data-label');
        const val = g.getAttribute('data-value');
        this.showTooltip(e, `<strong>${label}</strong>: ${val} ครั้ง`);
      });
      g.addEventListener('mouseleave', () => this.hideTooltip());
    });
  }
}

window.chartEngine = new HospitalChartEngine();
