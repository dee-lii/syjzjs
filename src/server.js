/**
 * VPS 剩余价值计算 API 服务器
 * 提供计算 API 和健康检查端点
 */

const express = require('express');
const path = require('path');
const {
  calculateRemainingValue,
  getDaysByCycle,
  calculateUsedDays
} = require('./calculator');

const app = express();
const PORT = process.env.PORT || 3000;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function parseNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function isValidDate(value) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sanitizeColor(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  if (/[<>"'&]/.test(trimmed)) return null;
  if (!/^[#a-zA-Z0-9(),.%\s-]+$/.test(trimmed)) return null;
  return trimmed;
}

function clampInt(value, fallback, min, max) {
  const num = parseNumber(value);
  if (num === null) return fallback;
  const rounded = Math.round(num);
  if (!Number.isFinite(rounded)) return fallback;
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}

function clampFloat(value, fallback, min, max) {
  const num = parseNumber(value);
  if (num === null) return fallback;
  if (num < min) return min;
  if (num > max) return max;
  return num;
}

function resolveGradientAngle({ gradientAngle, gradientDirection }) {
  if (gradientDirection) {
    const key = String(gradientDirection).toLowerCase();
    const map = {
      horizontal: 0,
      vertical: 90,
      diagonal: 45,
      diagonal2: 135
    };
    if (map[key] !== undefined) {
      return map[key];
    }
  }
  return clampFloat(gradientAngle, 45, 0, 360);
}

function buildPyqSvg(options) {
  const {
    size,
    ringWidth,
    ringPadding,
    text,
    textSize,
    textColor,
    font,
    gradient,
    background,
    gradientAngle,
    glow,
    glowColor,
    glowBlur,
    glowOpacity,
    shadow,
    shadowColor,
    shadowDx,
    shadowDy,
    shadowBlur
  } = options;

  const radius = size / 2 - ringWidth / 2 - ringPadding;
  if (radius <= 0) {
    return { error: 'size、ringWidth、ringPadding 组合导致圆环半径为非正值' };
  }

  const safeText = escapeXml((text || 'PYQ').toString().slice(0, 12));
  const safeFont = escapeXml(
    (font || 'Arial Rounded MT Bold, Helvetica Rounded, Arial, sans-serif').toString()
  );
  const safeTextColor = sanitizeColor(textColor) || '#ffffff';
  const safeBackground = sanitizeColor(background);

  const defaultGradient = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff', '#af52de'];
  const gradientStops = (gradient || '')
    .split(',')
    .map((item) => sanitizeColor(item))
    .filter(Boolean);
  const colors = gradientStops.length >= 2 ? gradientStops : defaultGradient;
  const stops = colors.map((color, index) => {
    const offset = Math.round((index / (colors.length - 1)) * 100);
    return `<stop offset="${offset}%" stop-color="${escapeXml(color)}"/>`;
  }).join('');

  const angle = resolveGradientAngle({ gradientAngle, gradientDirection: options.gradientDirection });
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const x1 = (50 - cos * 50).toFixed(2);
  const y1 = (50 - sin * 50).toFixed(2);
  const x2 = (50 + cos * 50).toFixed(2);
  const y2 = (50 + sin * 50).toFixed(2);

  const textX = size / 2;
  const textY = size / 2;
  const bgRect = safeBackground && safeBackground !== 'transparent' && safeBackground !== 'none'
    ? `<rect width="${size}" height="${size}" fill="${escapeXml(safeBackground)}"/>`
    : '';

  const glowEnabled = Boolean(glow);
  const shadowTarget = (shadow || '').toString().toLowerCase();
  const safeGlowColor = sanitizeColor(glowColor) || 'rgba(255,255,255,0.7)';
  const finalGlowBlur = clampFloat(glowBlur, 6, 0, 64);
  const finalGlowOpacity = clampFloat(glowOpacity, 0.7, 0, 1);

  const safeShadowColor = sanitizeColor(shadowColor) || 'rgba(0,0,0,0.25)';
  const finalShadowDx = clampFloat(shadowDx, 0, -50, 50);
  const finalShadowDy = clampFloat(shadowDy, 6, -50, 50);
  const finalShadowBlur = clampFloat(shadowBlur, 8, 0, 64);

  const ringFilter = shadowTarget === 'ring' || shadowTarget === 'both' ? 'url(#shadow)' : '';
  const textFilter = shadowTarget === 'text' || shadowTarget === 'both' ? 'url(#shadow)' : '';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${safeText}">
  <defs>
    <linearGradient id="ring" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">
      ${stops}
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="${finalGlowBlur}" />
    </filter>
    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="${finalShadowDx}" dy="${finalShadowDy}" stdDeviation="${finalShadowBlur}" flood-color="${escapeXml(safeShadowColor)}" />
    </filter>
  </defs>
  ${bgRect}
  ${glowEnabled ? `<circle cx="${textX}" cy="${textY}" r="${radius}" fill="none" stroke="${escapeXml(safeGlowColor)}" stroke-width="${ringWidth}" opacity="${finalGlowOpacity}" filter="url(#glow)"/>` : ''}
  <circle cx="${textX}" cy="${textY}" r="${radius}" fill="none" stroke="url(#ring)" stroke-width="${ringWidth}"${ringFilter ? ` filter="${ringFilter}"` : ''}/>
  <text x="${textX}" y="${textY}" text-anchor="middle" dominant-baseline="middle"
        font-size="${textSize}" font-weight="700" font-family="${safeFont}"
        fill="${escapeXml(safeTextColor)}"${textFilter ? ` filter="${textFilter}"` : ''}>${safeText}</text>
</svg>`;

  return { svg };
}

// 汇率缓存（内存）
const exchangeRateCache = {
  data: {}, // { 'USD-CNY': { rate: 7.2, timestamp: 1234567890, source: 'api' } }
  duration: 60 * 60 * 1000 // 1小时缓存
};

// 汇率 API 源列表（按优先级排序）
const EXCHANGE_RATE_APIS = [
  {
    name: 'exchangerate-api.com',
    url: (from) => `https://api.exchangerate-api.com/v4/latest/${from}`,
    parse: (data, to) => data.rates?.[to]
  },
  {
    name: 'open.er-api.com',
    url: (from) => `https://open.er-api.com/v6/latest/${from}`,
    parse: (data, to) => data.rates?.[to]
  },
  {
    name: 'api.frankfurter.app',
    url: (from, to) => `https://api.frankfurter.app/latest?from=${from}&to=${to}`,
    parse: (data, to) => data.rates?.[to]
  }
];

// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 获取汇率数据（支持多 API 源和缓存）
async function fetchExchangeRate(from, to) {
  const cacheKey = `${from}-${to}`;
  const now = Date.now();

  // 检查缓存
  const cached = exchangeRateCache.data[cacheKey];
  if (cached && (now - cached.timestamp < exchangeRateCache.duration)) {
    return { ...cached, fromCache: false }; // 缓存仍有效，标记为非降级缓存
  }

  const https = require('https');

  // 尝试所有 API 源
  for (const api of EXCHANGE_RATE_APIS) {
    try {
      const url = api.url(from, to);
      const data = await new Promise((resolve, reject) => {
        https.get(url, (apiRes) => {
          let data = '';
          apiRes.on('data', (chunk) => { data += chunk; });
          apiRes.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(new Error('解析失败'));
            }
          });
        }).on('error', reject);
      });

      const rate = api.parse(data, to);
      if (rate && rate > 0) {
        // 成功获取汇率，更新缓存
        const result = {
          rate: parseFloat(rate.toFixed(4)),
          timestamp: now,
          source: api.name
        };
        exchangeRateCache.data[cacheKey] = result;
        return { ...result, fromCache: false };
      }
    } catch (error) {
      console.log(`API ${api.name} 失败:`, error.message);
      continue; // 尝试下一个 API
    }
  }

  // 所有 API 都失败，使用降级缓存
  if (cached) {
    console.log(`所有 API 失败，使用降级缓存: ${cacheKey}`);
    return { ...cached, fromCache: true }; // 标记为降级缓存
  }

  throw new Error('所有汇率 API 源均不可用且无可用缓存');
}

// 汇率 API（支持多源和缓存）
app.get('/api/exchange-rate', async (req, res) => {
  try {
    const { from = 'USD', to = 'CNY' } = req.query;

    // 支持的货币列表（新增韩元）
    const supportedCurrencies = ['USD', 'CNY', 'EUR', 'GBP', 'JPY', 'KRW'];

    if (!supportedCurrencies.includes(from) || !supportedCurrencies.includes(to)) {
      return res.status(400).json({
        success: false,
        error: `不支持的货币类型，支持的货币：${supportedCurrencies.join(', ')}`
      });
    }

    // 如果是相同货币，直接返回 1
    if (from === to) {
      return res.json({
        success: true,
        data: {
          base: from,
          target: to,
          rate: 1,
          timestamp: new Date().toISOString(),
          source: 'direct',
          fromCache: false
        }
      });
    }

    // 获取汇率数据
    const result = await fetchExchangeRate(from, to);

    res.json({
      success: true,
      data: {
        base: from,
        target: to,
        rate: result.rate,
        timestamp: new Date(result.timestamp).toISOString(),
        source: result.source,
        fromCache: result.fromCache // 是否使用降级缓存
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// SVG 徽章生成 API（支持动态计算）
app.get('/api/badge.svg', (req, res) => {
  try {
    const {
      startDate,
      endDate,
      currency = 'CNY',
      remainingValue: inputRemainingValue,
      totalCost,
      totalDays,  // 新增：总天数，用于动态计算
      source      // 新增：出处网址
    } = req.query;

    // 参数验证
    if (!startDate || !endDate || totalCost === undefined) {
      return res.status(400).json({
        success: false,
        error: '缺少必需参数：startDate, endDate, totalCost'
      });
    }

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return res.status(400).json({
        success: false,
        error: '日期格式不正确'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      return res.status(400).json({
        success: false,
        error: '结束日期不能早于开始日期'
      });
    }

    const totalCostNum = parseNumber(totalCost);
    if (totalCostNum === null || totalCostNum <= 0) {
      return res.status(400).json({
        success: false,
        error: 'totalCost 必须是大于 0 的数字'
      });
    }

    // 货币符号映射
    const currencySymbols = {
      'CNY': '¥',
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
      'KRW': '₩'
    };

    const symbol = currencySymbols[currency] || currency;

    let remainingValue = parseNumber(inputRemainingValue);
    let usageRate;

    // 如果提供了 totalDays，则进行动态计算
    if (totalDays !== undefined) {
      const totalDaysNum = parseNumber(totalDays);
      if (!Number.isInteger(totalDaysNum) || totalDaysNum <= 0) {
        return res.status(400).json({
          success: false,
          error: 'totalDays 必须是大于 0 的整数'
        });
      }

      const now = Date.now();

      // 计算已使用天数
      const usedDays = Math.floor((now - start.getTime()) / MS_PER_DAY);
      if (usedDays < 0) {
        return res.status(400).json({
          success: false,
          error: '开始日期不能晚于当前日期'
        });
      }

      // 确保不超过总天数
      const actualUsedDays = Math.min(usedDays, totalDaysNum);

      // 计算剩余天数和剩余价值
      const remainingDays = Math.max(0, totalDaysNum - actualUsedDays);
      const dailyRate = totalCostNum / totalDaysNum;
      remainingValue = dailyRate * remainingDays;

      // 计算使用率
      usageRate = ((actualUsedDays / totalDaysNum) * 100).toFixed(1);
    } else {
      if (remainingValue === null) {
        return res.status(400).json({
          success: false,
          error: '缺少必需参数：remainingValue'
        });
      }
      // 静态模式：使用传入的剩余价值
      usageRate = ((totalCostNum - remainingValue) / totalCostNum * 100).toFixed(1);
    }

    // 根据使用率选择颜色
    let color = '#44cc11'; // 绿色（使用率低）
    if (usageRate > 70) {
      color = '#e05d44'; // 红色（使用率高）
    } else if (usageRate > 40) {
      color = '#dfb317'; // 橙色（使用率中等）
    }

    // 生成 SVG
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="280" height="${source ? '140' : '120'}" role="img" aria-label="VPS 剩余价值">
  <title>VPS 剩余价值</title>
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- 背景 -->
  <rect width="280" height="${source ? '140' : '120'}" rx="8" fill="url(#grad)"/>

  <!-- 标题 -->
  <text x="140" y="25" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="white" text-anchor="middle">
    VPS 剩余价值
  </text>

  <!-- 日期范围 -->
  <text x="140" y="45" font-family="Arial, sans-serif" font-size="11" fill="white" text-anchor="middle" opacity="0.9">
    ${startDate} 至 ${endDate}
  </text>

  <!-- 剩余价值 -->
  <text x="140" y="75" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="white" text-anchor="middle">
    ${symbol}${parseFloat(remainingValue).toFixed(2)}
  </text>

  <!-- 使用率 -->
  <rect x="40" y="90" width="200" height="20" rx="10" fill="white" opacity="0.3"/>
  <rect x="40" y="90" width="${usageRate * 2}" height="20" rx="10" fill="${color}"/>
  <text x="140" y="104" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="white" text-anchor="middle">
    已使用 ${usageRate}%
  </text>${source ? `

  <!-- 出处 -->
  <text x="140" y="128" font-family="Arial, sans-serif" font-size="9" fill="white" text-anchor="middle" opacity="0.7">
    出自: ${source}
  </text>` : ''}
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(svg);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PYQ 徽章（256x256，透明底，七彩渐变圆环）
app.get('/svgsc', (req, res) => {
  const {
    size,
    ringWidth,
    ringPadding,
    text,
    textSize,
    textColor,
    font,
    gradient,
    background,
    gradientAngle,
    gradientDirection,
    glow,
    glowColor,
    glowBlur,
    glowOpacity,
    shadow,
    shadowColor,
    shadowDx,
    shadowDy,
    shadowBlur
  } = req.query;

  const finalSize = clampInt(size, 256, 64, 1024);
  const finalRingWidth = clampInt(ringWidth, 18, 2, 128);
  const finalPadding = clampInt(ringPadding, 8, 0, 128);
  const finalTextSize = clampInt(textSize, 64, 10, 256);

  const { svg, error } = buildPyqSvg({
    size: finalSize,
    ringWidth: finalRingWidth,
    ringPadding: finalPadding,
    text,
    textSize: finalTextSize,
    textColor,
    font,
    gradient,
    background,
    gradientAngle,
    gradientDirection,
    glow,
    glowColor,
    glowBlur,
    glowOpacity,
    shadow,
    shadowColor,
    shadowDx,
    shadowDy,
    shadowBlur
  });

  if (error) {
    return res.status(400).json({ success: false, error });
  }

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(svg);
});

app.get('/svgsc.png', async (req, res) => {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'PNG 导出需要安装依赖 sharp：npm install'
    });
  }

  const {
    size,
    ringWidth,
    ringPadding,
    text,
    textSize,
    textColor,
    font,
    gradient,
    background,
    gradientAngle,
    gradientDirection,
    glow,
    glowColor,
    glowBlur,
    glowOpacity,
    shadow,
    shadowColor,
    shadowDx,
    shadowDy,
    shadowBlur
  } = req.query;

  const finalSize = clampInt(size, 256, 64, 1024);
  const finalRingWidth = clampInt(ringWidth, 18, 2, 128);
  const finalPadding = clampInt(ringPadding, 8, 0, 128);
  const finalTextSize = clampInt(textSize, 64, 10, 256);

  const { svg, error } = buildPyqSvg({
    size: finalSize,
    ringWidth: finalRingWidth,
    ringPadding: finalPadding,
    text,
    textSize: finalTextSize,
    textColor,
    font,
    gradient,
    background,
    gradientAngle,
    gradientDirection,
    glow,
    glowColor,
    glowBlur,
    glowOpacity,
    shadow,
    shadowColor,
    shadowDx,
    shadowDy,
    shadowBlur
  });

  if (error) {
    return res.status(400).json({ success: false, error });
  }

  try {
    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(pngBuffer);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'PNG 生成失败'
    });
  }
});

// 二维码生成接口
app.get('/ewm', async (req, res) => {
  let qrcode;
  try {
    qrcode = require('qrcode');
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: '二维码生成需要安装依赖 qrcode：npm install'
    });
  }

  const {
    text,
    data,
    url,
    format = 'png',
    size = 256,
    margin = 2,
    dark = '#000000',
    light = '#ffffff'
  } = req.query;

  const content = (text || data || url || '').toString().trim();
  if (!content) {
    return res.status(400).json({
      success: false,
      error: '缺少二维码内容参数：text 或 data 或 url'
    });
  }

  const finalSize = clampInt(size, 256, 64, 1024);
  const finalMargin = clampInt(margin, 2, 0, 10);
  const darkColor = sanitizeColor(dark) || '#000000';
  const lightColor = sanitizeColor(light) || '#ffffff';
  const output = String(format).toLowerCase();

  try {
    if (output === 'svg') {
      const svg = await qrcode.toString(content, {
        type: 'svg',
        margin: finalMargin,
        width: finalSize,
        color: {
          dark: darkColor,
          light: lightColor
        }
      });
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'no-cache');
      return res.send(svg);
    }

    const buffer = await qrcode.toBuffer(content, {
      type: 'png',
      margin: finalMargin,
      width: finalSize,
      color: {
        dark: darkColor,
        light: lightColor
      }
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache');
    return res.send(buffer);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: '二维码生成失败'
    });
  }
});

// 计算剩余价值 API
app.post('/api/calculate', (req, res) => {
  try {
    const { totalCost, totalDays, usedDays } = req.body;

    // 参数验证
    if (totalCost === undefined || totalDays === undefined || usedDays === undefined) {
      return res.status(400).json({
        success: false,
        error: '缺少必需参数：totalCost, totalDays, usedDays'
      });
    }

    // 执行计算
    const result = calculateRemainingValue(
      Number(totalCost),
      Number(totalDays),
      Number(usedDays)
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// 快捷计算端点（通过付款周期和购买日期）
app.post('/api/calculate-by-cycle', (req, res) => {
  try {
    const { totalCost, cycle, purchaseDate } = req.body;

    // 参数验证
    if (!totalCost || !cycle || !purchaseDate) {
      return res.status(400).json({
        success: false,
        error: '缺少必需参数：totalCost, cycle, purchaseDate'
      });
    }

    // 获取总天数
    const totalDays = getDaysByCycle(cycle);

    // 计算已使用天数
    const usedDays = calculateUsedDays(purchaseDate);

    // 执行计算
    const result = calculateRemainingValue(
      Number(totalCost),
      totalDays,
      usedDays
    );

    res.json({
      success: true,
      data: {
        ...result,
        totalDays,
        usedDays,
        purchaseDate,
        cycle
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

// 启动服务器（仅在非测试环境下启动）
let server;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    console.log(`VPS 剩余价值计算服务已启动`);
    console.log(`访问地址: http://localhost:${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/api/health`);
  });

  // 优雅关闭
  process.on('SIGTERM', () => {
    console.log('收到 SIGTERM 信号，准备关闭服务器...');
    server.close(() => {
      console.log('服务器已关闭');
      process.exit(0);
    });
  });
}

module.exports = app;
