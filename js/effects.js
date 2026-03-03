/**
 * effects.js — Canvas エフェクトエンジン
 * 
 * Canvas 2D Context を使ったピクセル操作によるリアルタイム画像エフェクト。
 */

const PhotoEffects = (() => {
    'use strict';

    /** オリジナル画像の ImageData を保持 */
    let originalImageData = null;
    let canvas = null;
    let ctx = null;
    let sourceImage = null;

    /**
     * Canvas と画像を初期化
     * @param {HTMLCanvasElement} canvasEl
     * @param {HTMLImageElement} img
     */
    function init(canvasEl, img) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d', { willReadFrequently: true });
        sourceImage = img;

        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        ctx.drawImage(img, 0, 0);
        originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    /**
     * エフェクトを適用して Canvas を更新
     * @param {Object} params - エフェクトパラメータ
     */
    function applyEffects(params) {
        if (!originalImageData) return;

        // 一時的な offscreen canvas で作業
        const w = canvas.width;
        const h = canvas.height;

        // まず元画像を描画（blur用に CSS filter を使用するため）
        ctx.clearRect(0, 0, w, h);

        // ぼかし処理は CSS filter で適用
        if (params.blur > 0) {
            ctx.filter = `blur(${params.blur}px)`;
        } else {
            ctx.filter = 'none';
        }

        ctx.drawImage(sourceImage, 0, 0);
        ctx.filter = 'none';

        // ピクセルデータを取得
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        const origData = originalImageData.data;

        // 各ピクセルにエフェクトを適用
        for (let i = 0; i < data.length; i += 4) {
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

        ctx.putImageData(imageData, 0, 0);

        // --- ピクセル化 (Pixelate) ---
        if (params.pixelate > 1) {
            applyPixelate(params.pixelate);
        }

        // --- イラスト風 (Illustration / Cartoon) ---
        if (params.illustration > 0) {
            applyIllustration(params.illustration);
        }

        // --- シャープネス (Sharpness) ---
        if (params.sharpness > 0) {
            applySharpness(params.sharpness);
        }

        // --- ビネット (Vignette) ---
        if (params.vignette > 0) {
            applyVignette(params.vignette);
        }
    }

    /**
     * アンシャープマスクによるシャープネス
     */
    function applySharpness(amount) {
        const w = canvas.width;
        const h = canvas.height;
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;

        // ぼかし版を一時 canvas で作成
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = w;
        tmpCanvas.height = h;
        const tmpCtx = tmpCanvas.getContext('2d');
        tmpCtx.filter = 'blur(1px)';
        tmpCtx.drawImage(canvas, 0, 0);
        tmpCtx.filter = 'none';
        const blurData = tmpCtx.getImageData(0, 0, w, h).data;

        const strength = amount / 50; // 0~100 → 0~2

        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.max(0, Math.min(255, data[i] + (data[i] - blurData[i]) * strength | 0));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + (data[i + 1] - blurData[i + 1]) * strength | 0));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + (data[i + 2] - blurData[i + 2]) * strength | 0));
        }

        ctx.putImageData(imageData, 0, 0);
    }

    /**
     * 放射状グラデーションによるビネット
     */
    function applyVignette(amount) {
        const w = canvas.width;
        const h = canvas.height;
        const strength = amount / 100;

        const cx = w / 2;
        const cy = h / 2;
        const radius = Math.max(cx, cy) * 1.2;

        const gradient = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius);
        gradient.addColorStop(0, `rgba(0, 0, 0, 0)`);
        gradient.addColorStop(0.7, `rgba(0, 0, 0, ${0.2 * strength})`);
        gradient.addColorStop(1, `rgba(0, 0, 0, ${0.7 * strength})`);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
    }

    /**
     * ピクセル化エフェクト
     * 画像を縮小→拡大してモザイクのような効果を生む
     */
    function applyPixelate(blockSize) {
        const w = canvas.width;
        const h = canvas.height;
        const size = Math.max(2, blockSize | 0);

        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = w;
        tmpCanvas.height = h;
        const tmpCtx = tmpCanvas.getContext('2d');

        // 現在の canvas を取得
        tmpCtx.drawImage(canvas, 0, 0);

        // 縮小してから拡大（nearest neighbor でピクセル化）
        ctx.clearRect(0, 0, w, h);
        ctx.imageSmoothingEnabled = false;

        const smallW = Math.max(1, Math.ceil(w / size));
        const smallH = Math.max(1, Math.ceil(h / size));

        ctx.drawImage(tmpCanvas, 0, 0, w, h, 0, 0, smallW, smallH);
        ctx.drawImage(canvas, 0, 0, smallW, smallH, 0, 0, w, h);

        ctx.imageSmoothingEnabled = true;
    }

    /**
     * イラスト風（カートゥーン）エフェクト
     * Sobel エッジ検出で黒いアウトラインを重ねてイラスト感を出す
     */
    function applyIllustration(amount) {
        const w = canvas.width;
        const h = canvas.height;
        const strength = amount / 100; // 0~1

        // 現在の画像データからエッジを検出
        const srcData = ctx.getImageData(0, 0, w, h);
        const src = srcData.data;

        // エッジ用の一時 ImageData
        const edgeData = ctx.createImageData(w, h);
        const edge = edgeData.data;

        // Sobel カーネル
        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const idx = (y * w + x) * 4;

                // 周囲ピクセルのグレースケール値を取得
                const getGray = (ox, oy) => {
                    const i = ((y + oy) * w + (x + ox)) * 4;
                    return 0.2126 * src[i] + 0.7152 * src[i + 1] + 0.0722 * src[i + 2];
                };

                // Sobel X & Y
                const gx = -getGray(-1, -1) - 2 * getGray(-1, 0) - getGray(-1, 1)
                    + getGray(1, -1) + 2 * getGray(1, 0) + getGray(1, 1);
                const gy = -getGray(-1, -1) - 2 * getGray(0, -1) - getGray(1, -1)
                    + getGray(-1, 1) + 2 * getGray(0, 1) + getGray(1, 1);

                const magnitude = Math.sqrt(gx * gx + gy * gy);

                // エッジの強度をアルファとして使用（閾値調整）
                const edgeVal = Math.min(255, magnitude * 1.5);
                edge[idx] = 0;   // R (黒)
                edge[idx + 1] = 0;   // G
                edge[idx + 2] = 0;   // B
                edge[idx + 3] = edgeVal * strength | 0; // Alpha
            }
        }

        // エッジを元画像に重ねる
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = w;
        tmpCanvas.height = h;
        const tmpCtx = tmpCanvas.getContext('2d');
        tmpCtx.putImageData(edgeData, 0, 0);

        ctx.drawImage(tmpCanvas, 0, 0);
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
        applyEffects,
        toDataURL,
        toBlob
    };
})();
