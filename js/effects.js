/**
 * effects.js — Canvas エフェクトエンジン
 * 
 * Canvas 2D Context を使ったピクセル操作によるリアルタイム画像エフェクト。
 */

const PhotoEffects = (() => {
    'use strict';

    let canvas = null;
    let ctx = null;

    /**
     * Canvas の初期化 (最初の起動用)
     * @param {HTMLCanvasElement} canvasEl
     */
    function init(canvasEl) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d', { willReadFrequently: true });
    }

    /**
     * 単一レイヤーにエフェクトを適用し、そのレイヤー専用のオフスクリーンCanvasを更新
     * @param {Object} layer - LayerManagerのレイヤーオブジェクト
     */
    function applyEffectsToLayer(layer) {
        if (!layer.image) return;

        const offCanvas = layer.offscreen;
        const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
        const params = layer.params;
        const w = offCanvas.width;
        const h = offCanvas.height;

        // クリア
        offCtx.clearRect(0, 0, w, h);

        // まず元画像を描画（ぼかし処理は CSS filter を使用）
        if (params.blur > 0) {
            offCtx.filter = `blur(${params.blur}px)`;
        } else {
            offCtx.filter = 'none';
        }

        // 中央に描画 (サイズが異なる場合の簡易対応)
        const dx = (w - layer.image.naturalWidth) / 2;
        const dy = (h - layer.image.naturalHeight) / 2;
        offCtx.drawImage(layer.image, dx, dy);
        offCtx.filter = 'none';

        // ピクセルデータを取得
        const imageData = offCtx.getImageData(0, 0, w, h);
        const data = imageData.data;

        // カスタムエフェクトの適用
        for (let i = 0; i < data.length; i += 4) {
            // 完全透明ならスキップ（アルファ対応）
            if (data[i + 3] === 0) continue;
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];

            // --- 明るさ (Brightness) ---
            if (params.brightness !== 0) {
                const bright = params.brightness * 2.55; // -100~100 → -255~255
                r += bright;
                g += bright;
                b += bright;
            }

            // --- コントラスト (Contrast) ---
            if (params.contrast !== 0) {
                const factor = (259 * (params.contrast + 255)) / (255 * (259 - params.contrast));
                r = factor * (r - 128) + 128;
                g = factor * (g - 128) + 128;
                b = factor * (b - 128) + 128;
            }

            // --- 色温度 (Temperature) ---
            if (params.temperature !== 0) {
                const temp = params.temperature * 1.5;
                r += temp;
                b -= temp;
            }

            // --- 彩度 (Saturation) ---
            if (params.saturation !== 0) {
                const sat = params.saturation / 100;
                const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                r = gray + (r - gray) * (1 + sat);
                g = gray + (g - gray) * (1 + sat);
                b = gray + (b - gray) * (1 + sat);
            }

            // --- セピア (Sepia) ---
            if (params.sepia > 0) {
                const sep = params.sepia / 100;
                const sr = 0.393 * r + 0.769 * g + 0.189 * b;
                const sg = 0.349 * r + 0.686 * g + 0.168 * b;
                const sb = 0.272 * r + 0.534 * g + 0.131 * b;
                r = r + (sr - r) * sep;
                g = g + (sg - g) * sep;
                b = b + (sb - b) * sep;
            }

            // --- グレースケール (Grayscale) ---
            if (params.grayscale > 0) {
                const gs = params.grayscale / 100;
                const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                r = r + (gray - r) * gs;
                g = g + (gray - g) * gs;
                b = b + (gray - b) * gs;
            }

            // --- ポスタリゼーション (Posterize) ---
            if (params.posterize < 32) {
                const levels = params.posterize;
                const step = 255 / (levels - 1);
                r = Math.round(r / step) * step;
                g = Math.round(g / step) * step;
                b = Math.round(b / step) * step;
            }

            // クランプ
            data[i] = Math.max(0, Math.min(255, r | 0));
            data[i + 1] = Math.max(0, Math.min(255, g | 0));
            data[i + 2] = Math.max(0, Math.min(255, b | 0));
        }

        offCtx.putImageData(imageData, 0, 0);

        // --- Post-processing Effects ---
        if (params.pixelate > 1) {
            _applyPixelate(offCanvas, offCtx, params.pixelate);
        }
        if (params.illustration > 0) {
            _applyIllustration(offCanvas, offCtx, params.illustration);
        }
        if (params.sharpness > 0) {
            _applySharpness(offCanvas, offCtx, params.sharpness);
        }
        if (params.vignette > 0) {
            _applyVignette(offCanvas, offCtx, params.vignette);
        }
    }

    /**
     * 全レイヤーを指定のレイヤー順に合成し、メインキャンバスに描画
     */
    function compositeAllLayers(layers) {
        if (!ctx) return;
        const w = canvas.width;
        const h = canvas.height;

        // メインキャンバスをクリア (透過維持)
        ctx.clearRect(0, 0, w, h);

        layers.forEach(layer => {
            if (!layer.visible) return;

            // 再計算が必要なら計算する
            if (layer.needsUpdate) {
                applyEffectsToLayer(layer);
                layer.needsUpdate = false;
            }

            // 合成モードと不透明度を設定
            ctx.globalAlpha = layer.opacity;
            ctx.globalCompositeOperation = layer.blendMode;

            // メインキャンバスに描画
            ctx.drawImage(layer.offscreen, 0, 0);
        });

        // 状態をリセット
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';
    }

    /**
     * アンシャープマスクによるシャープネス
     */
    function _applySharpness(targetCanvas, targetCtx, amount) {
        const w = targetCanvas.width;
        const h = targetCanvas.height;
        const imageData = targetCtx.getImageData(0, 0, w, h);
        const data = imageData.data;

        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = w;
        tmpCanvas.height = h;
        const tmpCtx = tmpCanvas.getContext('2d');
        tmpCtx.filter = 'blur(1px)';
        tmpCtx.drawImage(targetCanvas, 0, 0);
        tmpCtx.filter = 'none';
        const blurData = tmpCtx.getImageData(0, 0, w, h).data;

        const strength = amount / 50;

        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] === 0) continue; // 透明ピクセルスキップ
            data[i] = Math.max(0, Math.min(255, data[i] + (data[i] - blurData[i]) * strength | 0));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + (data[i + 1] - blurData[i + 1]) * strength | 0));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + (data[i + 2] - blurData[i + 2]) * strength | 0));
        }

        targetCtx.putImageData(imageData, 0, 0);
    }

    /**
     * 放射状グラデーションによるビネット
     */
    function _applyVignette(targetCanvas, targetCtx, amount) {
        const w = targetCanvas.width;
        const h = targetCanvas.height;
        const strength = amount / 100;

        const cx = w / 2;
        const cy = h / 2;
        const radius = Math.max(cx, cy) * 1.2;

        const gradient = targetCtx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius);
        gradient.addColorStop(0, `rgba(0, 0, 0, 0)`);
        gradient.addColorStop(0.7, `rgba(0, 0, 0, ${0.2 * strength})`);
        gradient.addColorStop(1, `rgba(0, 0, 0, ${0.7 * strength})`);

        targetCtx.fillStyle = gradient;
        // globalCompositeOperationを `source-atop` にすることで不透明ピクセルにのみビネットを適用する
        targetCtx.globalCompositeOperation = 'source-atop';
        targetCtx.fillRect(0, 0, w, h);
        targetCtx.globalCompositeOperation = 'source-over';
    }

    /**
     * ピクセル化エフェクト
     */
    function _applyPixelate(targetCanvas, targetCtx, blockSize) {
        const w = targetCanvas.width;
        const h = targetCanvas.height;
        const size = Math.max(2, blockSize | 0);

        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = w;
        tmpCanvas.height = h;
        const tmpCtx = tmpCanvas.getContext('2d');

        tmpCtx.drawImage(targetCanvas, 0, 0);

        targetCtx.clearRect(0, 0, w, h);
        targetCtx.imageSmoothingEnabled = false;

        const smallW = Math.max(1, Math.ceil(w / size));
        const smallH = Math.max(1, Math.ceil(h / size));

        targetCtx.drawImage(tmpCanvas, 0, 0, w, h, 0, 0, smallW, smallH);
        targetCtx.drawImage(targetCanvas, 0, 0, smallW, smallH, 0, 0, w, h);

        targetCtx.imageSmoothingEnabled = true;
    }

    /**
     * イラスト風エフェクト
     */
    function _applyIllustration(targetCanvas, targetCtx, amount) {
        const w = targetCanvas.width;
        const h = targetCanvas.height;
        const strength = amount / 100;

        const srcData = targetCtx.getImageData(0, 0, w, h);
        const src = srcData.data;
        const edgeData = targetCtx.createImageData(w, h);
        const edge = edgeData.data;

        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const idx = (y * w + x) * 4;
                if (src[idx + 3] === 0) continue; // 透明ならスキップ

                const getGray = (ox, oy) => {
                    const i = ((y + oy) * w + (x + ox)) * 4;
                    // 透明部分はエッジとして処理しないように調整
                    if (src[i + 3] === 0) return 255;
                    return 0.2126 * src[i] + 0.7152 * src[i + 1] + 0.0722 * src[i + 2];
                };

                const gx = -getGray(-1, -1) - 2 * getGray(-1, 0) - getGray(-1, 1)
                    + getGray(1, -1) + 2 * getGray(1, 0) + getGray(1, 1);
                const gy = -getGray(-1, -1) - 2 * getGray(0, -1) - getGray(1, -1)
                    + getGray(-1, 1) + 2 * getGray(0, 1) + getGray(1, 1);

                const magnitude = Math.sqrt(gx * gx + gy * gy);
                const edgeVal = Math.min(255, magnitude * 1.5);
                edge[idx] = 0;
                edge[idx + 1] = 0;
                edge[idx + 2] = 0;
                edge[idx + 3] = edgeVal * strength | 0;
            }
        }

        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = w;
        tmpCanvas.height = h;
        const tmpCtx = tmpCanvas.getContext('2d');
        tmpCtx.putImageData(edgeData, 0, 0);

        targetCtx.drawImage(tmpCanvas, 0, 0);
    }

    /**
     * Canvas を画像として返す
     * @param {string} format - MIMEタイプ
     * @param {number} quality - 品質 (0-1)
     * @returns {string} Data URL
     */
    function toDataURL(format = 'image/png', quality = 0.92) {
        return canvas.toDataURL(format, quality);
    }

    /**
     * Blob で返す
     */
    function toBlob(format = 'image/png', quality = 0.92) {
        return new Promise(resolve => {
            canvas.toBlob(resolve, format, quality);
        });
    }

    return {
        init,
        applyEffectsToLayer,
        compositeAllLayers,
        toDataURL,
        toBlob
    };
})();
