/**
 * app.js — アプリ全体の制御
 */

const App = (() => {
    'use strict';

    let currentFileName = 'photo';
    let renderPending = false;

    const dropzoneScreen = document.getElementById('dropzone-screen');
    const editorScreen = document.getElementById('editor-screen');
    const previewCanvas = document.getElementById('preview-canvas');
    const btnBack = document.getElementById('btn-back');
    const btnReset = document.getElementById('btn-reset');
    const btnDownload = document.getElementById('btn-download');
    const formatSelect = document.getElementById('format-select');
    const btnCopyParams = document.getElementById('btn-copy-params');
    const btnPasteParams = document.getElementById('btn-paste-params');

    // Layer UI Elements
    const layerListEl = document.getElementById('layer-list');
    const layerPropertiesEl = document.getElementById('layer-properties');
    const opacitySlider = document.getElementById('opacity-slider');
    const opacityVal = document.getElementById('opacity-val');
    const blendModeSelect = document.getElementById('blend-mode-select');
    const addLayerInput = document.getElementById('add-layer-input');

    /**
     * 初期化
     */
    function init() {
        // メインキャンバスの初期化
        PhotoEffects.init(previewCanvas);

        // レイヤーマネージャーの初期化
        LayerManager.init(previewCanvas, renderUIAndCanvas);

        // ドロップゾーン初期化
        Dropzone.init({
            dropzoneSelector: 'dropzone',
            fileInputSelector: 'file-input',
            onLoad: handleImageLoaded
        });

        // エディタへの追加ドロップも監視
        editorScreen.addEventListener('dragover', (e) => e.preventDefault());
        editorScreen.addEventListener('drop', handleAdditionalDrop);

        // レイヤー追加ボタン
        if (addLayerInput) {
            addLayerInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    processFile(e.target.files[0]);
                }
            });
        }

        // パラメータ UI 初期化
        ParamsUI.init({
            containerSelector: 'panel-body',
            onChange: handleParamsChange
        });

        // ボタンイベント
        btnBack.addEventListener('click', showDropzone);
        btnReset.addEventListener('click', handleReset);
        btnDownload.addEventListener('click', handleDownload);

        if (btnCopyParams) btnCopyParams.addEventListener('click', handleCopyParams);
        if (btnPasteParams) btnPasteParams.addEventListener('click', handlePasteParams);

        // レイヤープロパティのイベント
        if (opacitySlider) {
            opacitySlider.addEventListener('input', (e) => {
                const val = e.target.value;
                opacityVal.textContent = `${val}%`;
                const activeId = LayerManager.getActiveLayerId();
                if (activeId) {
                    LayerManager.updateLayerProperty(activeId, 'opacity', val / 100);
                }
            });
        }
        if (blendModeSelect) {
            blendModeSelect.addEventListener('change', (e) => {
                const activeId = LayerManager.getActiveLayerId();
                if (activeId) {
                    LayerManager.updateLayerProperty(activeId, 'blendMode', e.target.value);
                }
            });
        }
    }

    /**
     * 初回の画像が読み込まれた時の処理
     * @param {HTMLImageElement} img
     * @param {string} fileName
     */
    function handleImageLoaded(img, fileName) {
        currentFileName = fileName.replace(/\.[^.]+$/, '') || 'photo';

        // 最初のレイヤーを追加
        LayerManager.addLayer(img, fileName);

        // 画面遷移: ドロップゾーン → エディタ
        showEditor();
    }

    /**
     * 追加の画像がドロップされた時の処理
     */
    function handleAdditionalDrop(e) {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            processFile(files[0]);
        }
    }

    function processFile(file) {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => LayerManager.addLayer(img, file.name);
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    /**
     * レイヤーとCanvasの更新
     * @param {boolean} rebuildUI - UIまで再構築するか
     */
    function renderUIAndCanvas(rebuildUI = true) {
        if (rebuildUI) {
            updateLayerListUI();
            updateLayerPropertiesUI();

            // パラメータスライダーもアクティブレイヤーの値に更新
            const params = LayerManager.getActiveParams();
            if (params) {
                ParamsUI.setValues(params);
            }
        }

        if (!renderPending) {
            renderPending = true;
            requestAnimationFrame(() => {
                PhotoEffects.compositeAllLayers(LayerManager.getLayers());
                renderPending = false;
            });
        }
    }

    /**
     * パラメータ変更時
     */
    function handleParamsChange(values) {
        LayerManager.updateActiveParams(values);
    }

    /**
     * リセットボタン
     */
    function handleReset() {
        ParamsUI.resetAll();
    }

    /**
     * ダウンロードボタン
     */
    async function handleDownload() {
        const format = formatSelect.value;
        const ext = format === 'image/png' ? 'png' : format === 'image/jpeg' ? 'jpg' : 'webp';

        try {
            const blob = await PhotoEffects.toBlob(format, 0.92);
            if (!blob) return;

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${currentFileName}_effected.${ext}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download failed:', err);
        }
    }

    /**
     * パラメータをクリップボードにコピー
     */
    async function handleCopyParams() {
        const values = ParamsUI.getValues();
        const jsonStr = JSON.stringify(values);
        try {
            await navigator.clipboard.writeText(jsonStr);
            alert('パラメータをコピーしました');
        } catch (err) {
            console.warn('Clipboard write failed, using prompt fallback:', err);
            prompt('以下のテキストをコピーしてください（Ctrl+C または Cmd+C）', jsonStr);
        }
    }

    /**
     * パラメータをクリップボードからペースト
     */
    async function handlePasteParams() {
        let text = '';
        try {
            text = await navigator.clipboard.readText();
        } catch (err) {
            console.warn('Clipboard read failed, using prompt fallback:', err);
            text = prompt('コピーしたパラメータのテキストを貼り付けてください');
            if (!text) return; // キャンセルされた場合
        }

        try {
            const values = JSON.parse(text);
            const success = ParamsUI.setValues(values);
            if (!success) {
                alert('変更がないか、無効なパラメータデータです');
            }
        } catch (err) {
            console.error('Failed to paste params:', err);
            alert('ペーストに失敗しました（JSON形式のデータが必要です）');
        }
    }

    /**
     * 画面遷移: エディタへ
     */
    function showEditor() {
        dropzoneScreen.classList.add('fade-out');
        setTimeout(() => {
            dropzoneScreen.classList.remove('active', 'fade-out');
            editorScreen.classList.add('active');
        }, 400);
    }

    /**
     * レイヤー一覧UIの更新
     */
    function updateLayerListUI() {
        if (!layerListEl) return;
        layerListEl.innerHTML = '';

        // getLayersは下にあるほど前面（Canvas都合）。表示は下が下になるように反転配置する。
        // （Photoshop等の表示：上が前面、下が背面）
        const layers = [...LayerManager.getLayers()].reverse();
        const activeId = LayerManager.getActiveLayerId();

        layers.forEach((layer, index) => {
            // 元のインデックス
            const originalIndex = LayerManager.getLayers().findIndex(l => l.id === layer.id);

            const div = document.createElement('div');
            div.className = `layer-item ${layer.id === activeId ? 'active' : ''}`;
            div.style.cssText = `
                display: flex; align-items: center; justify-content: space-between;
                padding: 6px 12px; border-bottom: 1px solid var(--border);
                background: ${layer.id === activeId ? '#333' : 'transparent'};
                cursor: pointer;
            `;

            div.onclick = () => {
                LayerManager.setActiveLayer(layer.id);
            };

            const left = document.createElement('div');
            left.style.cssText = "display: flex; align-items: center; gap: 8px;";

            // 可視性トグル
            const eye = document.createElement('button');
            eye.className = "btn-icon";
            eye.style.cssText = "width: 20px; height: 20px; border: none;";
            eye.innerHTML = layer.visible ? '👁️' : '🕶️';
            eye.onclick = (e) => {
                e.stopPropagation();
                LayerManager.updateLayerProperty(layer.id, 'visible', !layer.visible);
            };

            const name = document.createElement('span');
            name.style.fontSize = "0.8rem";
            name.textContent = layer.name;
            name.style.opacity = layer.visible ? "1" : "0.4";

            left.appendChild(eye);
            left.appendChild(name);

            const right = document.createElement('div');
            right.style.cssText = "display: flex; align-items: center; gap: 4px;";

            // 上へ (配列ではインデックス増加)
            const btnUp = document.createElement('button');
            btnUp.innerHTML = '↑';
            btnUp.className = "btn-icon";
            btnUp.style.cssText = "width: 20px; height: 20px; border: none; font-size: 0.7rem;";
            btnUp.disabled = originalIndex === LayerManager.getLayers().length - 1;
            btnUp.onclick = (e) => {
                e.stopPropagation();
                LayerManager.swapLayers(originalIndex, originalIndex + 1);
            };

            // 下へ
            const btnDown = document.createElement('button');
            btnDown.innerHTML = '↓';
            btnDown.className = "btn-icon";
            btnDown.style.cssText = "width: 20px; height: 20px; border: none; font-size: 0.7rem;";
            btnDown.disabled = originalIndex === 0;
            btnDown.onclick = (e) => {
                e.stopPropagation();
                LayerManager.swapLayers(originalIndex, originalIndex - 1);
            };

            // 削除
            const btnDel = document.createElement('button');
            btnDel.innerHTML = '✕';
            btnDel.className = "btn-icon";
            btnDel.style.cssText = "width: 20px; height: 20px; border: none; font-size: 0.7rem; color: #ff6b6b;";
            btnDel.onclick = (e) => {
                e.stopPropagation();
                LayerManager.removeLayer(layer.id);
                // すべてのレイヤーが無くなったらドロップゾーンに戻る
                if (LayerManager.getLayers().length === 0) {
                    showDropzone();
                }
            };

            right.appendChild(btnUp);
            right.appendChild(btnDown);
            right.appendChild(btnDel);

            div.appendChild(left);
            div.appendChild(right);
            layerListEl.appendChild(div);
        });
    }

    /**
     * 選択レイヤーのプロパティUI表示更新
     */
    function updateLayerPropertiesUI() {
        if (!layerPropertiesEl) return;
        const activeId = LayerManager.getActiveLayerId();
        const layers = LayerManager.getLayers();
        const activeLayer = layers.find(l => l.id === activeId);

        if (activeLayer) {
            layerPropertiesEl.style.display = 'block';
            opacitySlider.value = activeLayer.opacity * 100;
            opacityVal.textContent = `${activeLayer.opacity * 100}%`;
            blendModeSelect.value = activeLayer.blendMode;
        } else {
            layerPropertiesEl.style.display = 'none';
        }
    }

    /**
     * 画面遷移: ドロップゾーンへ
     */
    function showDropzone() {
        editorScreen.classList.remove('active');
        dropzoneScreen.classList.add('active');
    }

    // DOM 読み込み完了後に初期化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return { init };
})();
