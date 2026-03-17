/**
 * ui.js — パラメータ UI コントロール
 */

const ParamsUI = (() => {
    'use strict';

    /** エフェクトパラメータ定義 */
    const EFFECT_PARAMS = [
        { key: 'brightness', label: '明るさ', icon: '☀️', min: -100, max: 100, defaultVal: 0, step: 1, unit: '' },
        { key: 'contrast', label: 'コントラスト', icon: '◑', min: -100, max: 100, defaultVal: 0, step: 1, unit: '' },
        { key: 'saturation', label: '彩度', icon: '🎨', min: -100, max: 100, defaultVal: 0, step: 1, unit: '' },
        { key: 'temperature', label: '色温度', icon: '🌡️', min: -100, max: 100, defaultVal: 0, step: 1, unit: '' },
        { key: 'sepia', label: 'セピア', icon: '📜', min: 0, max: 100, defaultVal: 0, step: 1, unit: '%' },
        { key: 'grayscale', label: 'グレースケール', icon: '⬛', min: 0, max: 100, defaultVal: 0, step: 1, unit: '%' },
        { key: 'blur', label: 'ぼかし', icon: '💧', min: 0, max: 20, defaultVal: 0, step: 0.5, unit: 'px' },
        { key: 'sharpness', label: 'シャープネス', icon: '🔪', min: 0, max: 100, defaultVal: 0, step: 1, unit: '' },
        { key: 'vignette', label: 'ビネット', icon: '⭕', min: 0, max: 100, defaultVal: 0, step: 1, unit: '%' },
        // --- フィルター・イラスト系 ---
        { key: 'lightBlur', label: '光ブラー', icon: '✨', min: 0, max: 100, defaultVal: 0, step: 1, unit: '%' },
        { key: 'posterize', label: 'ポスタリゼーション', icon: '🎭', min: 2, max: 32, defaultVal: 32, step: 1, unit: '色' },
        { key: 'illustration', label: 'イラスト風', icon: '✏️', min: 0, max: 100, defaultVal: 0, step: 1, unit: '' },
        { key: 'pixelate', label: 'ピクセル化', icon: '🟩', min: 1, max: 50, defaultVal: 1, step: 1, unit: 'px' },
    ];

    let containerEl = null;
    let onChange = null;
    let currentValues = {};
    let sliderElements = {};

    /**
     * パラメータ UI を初期化
     * @param {Object} options
     * @param {string} options.containerSelector
     * @param {function} options.onChange - パラメータ変更時コールバック (values: Object)
     */
    function init({ containerSelector, onChange: cb }) {
        containerEl = document.getElementById(containerSelector);
        onChange = cb;

        if (!containerEl) {
            console.error('ParamsUI: container not found');
            return;
        }

        // 初期値を設定
        resetValues();

        // スライダーを生成
        buildSliders();
    }

    /**
     * スライダー要素を生成
     */
    function buildSliders() {
        containerEl.innerHTML = '';

        EFFECT_PARAMS.forEach(param => {
            const group = document.createElement('div');
            group.className = 'slider-group';
            group.id = `group-${param.key}`;

            const header = document.createElement('div');
            header.className = 'slider-header';

            const label = document.createElement('label');
            label.className = 'slider-label';
            label.setAttribute('for', `slider-${param.key}`);
            label.innerHTML = `<span class="icon">${param.icon}</span> ${param.label}`;

            const valueDisplay = document.createElement('span');
            valueDisplay.className = 'slider-value';
            valueDisplay.id = `value-${param.key}`;
            valueDisplay.textContent = formatValue(param.defaultVal, param);

            header.appendChild(label);
            header.appendChild(valueDisplay);

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.id = `slider-${param.key}`;
            slider.className = 'filled';
            slider.min = param.min;
            slider.max = param.max;
            slider.step = param.step;
            slider.value = param.defaultVal;

            updateSliderFill(slider, param);

            // リアルタイム更新
            slider.addEventListener('input', () => {
                const val = parseFloat(slider.value);
                currentValues[param.key] = val;
                valueDisplay.textContent = formatValue(val, param);
                updateSliderFill(slider, param);

                if (onChange) {
                    onChange({ ...currentValues });
                }
            });

            // ダブルクリックでリセット
            slider.addEventListener('dblclick', () => {
                slider.value = param.defaultVal;
                currentValues[param.key] = param.defaultVal;
                valueDisplay.textContent = formatValue(param.defaultVal, param);
                updateSliderFill(slider, param);
                if (onChange) {
                    onChange({ ...currentValues });
                }
            });

            sliderElements[param.key] = { slider, valueDisplay };

            group.appendChild(header);
            group.appendChild(slider);
            containerEl.appendChild(group);
        });
    }

    /**
     * スライダーのフィル位置を更新
     */
    function updateSliderFill(slider, param) {
        const ratio = (slider.value - param.min) / (param.max - param.min);
        slider.style.setProperty('--fill', `${ratio * 100}%`);
    }

    /**
     * 値のフォーマット
     */
    function formatValue(val, param) {
        const sign = val > 0 ? '+' : '';
        const numStr = Number.isInteger(val) ? val.toString() : val.toFixed(1);
        return `${sign}${numStr}${param.unit}`;
    }

    /**
     * 全パラメータをリセット
     */
    function resetValues() {
        currentValues = {};
        EFFECT_PARAMS.forEach(param => {
            currentValues[param.key] = param.defaultVal;
        });
    }

    /**
     * UIをリセットしてコールバック呼び出し
     */
    function resetAll() {
        resetValues();
        EFFECT_PARAMS.forEach(param => {
            const el = sliderElements[param.key];
            if (el) {
                el.slider.value = param.defaultVal;
                el.valueDisplay.textContent = formatValue(param.defaultVal, param);
                updateSliderFill(el.slider, param);
            }
        });
        if (onChange) {
            onChange({ ...currentValues });
        }
    }

    /**
     * 現在の値を返す
     */
    function getValues() {
        return { ...currentValues };
    }

    /**
     * 値をセットしてUIを更新し、コールバック呼び出し
     */
    function setValues(newValues) {
        if (!newValues || typeof newValues !== 'object') return false;

        let changed = false;
        EFFECT_PARAMS.forEach(param => {
            if (newValues[param.key] !== undefined) {
                let val = parseFloat(newValues[param.key]);
                if (!isNaN(val)) {
                    val = Math.max(param.min, Math.min(param.max, val)); // クランプ
                    if (currentValues[param.key] !== val) {
                        currentValues[param.key] = val;
                        const el = sliderElements[param.key];
                        if (el) {
                            el.slider.value = val;
                            el.valueDisplay.textContent = formatValue(val, param);
                            updateSliderFill(el.slider, param);
                        }
                        changed = true;
                    }
                }
            }
        });

        if (changed && onChange) {
            onChange({ ...currentValues });
        }
        return changed; // 変更があった場合のみ true を返す
    }

    return {
        init,
        resetAll,
        getValues,
        setValues,
        EFFECT_PARAMS
    };
})();
