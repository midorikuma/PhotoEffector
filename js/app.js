/**
 * app.js — アプリ全体の制御
 */

const App = (() => {
    'use strict';

    let currentFileName = 'photo';
    let renderPending = false;

    // DOM 要素
    const dropzoneScreen = document.getElementById('dropzone-screen');
    const editorScreen = document.getElementById('editor-screen');
    const previewCanvas = document.getElementById('preview-canvas');
    const btnBack = document.getElementById('btn-back');
    const btnReset = document.getElementById('btn-reset');
    const btnDownload = document.getElementById('btn-download');
    const formatSelect = document.getElementById('format-select');
    const btnCopyParams = document.getElementById('btn-copy-params');
    const btnPasteParams = document.getElementById('btn-paste-params');

    /**
     * 初期化
     */
    function init() {
        // ドロップゾーン初期化
        Dropzone.init({
            dropzoneSelector: 'dropzone',
            fileInputSelector: 'file-input',
            onLoad: handleImageLoaded
        });

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
    }

    /**
     * 画像が読み込まれた時の処理
     * @param {HTMLImageElement} img
     * @param {string} fileName
     */
    function handleImageLoaded(img, fileName) {
        currentFileName = fileName.replace(/\.[^.]+$/, '') || 'photo';

        // エフェクトエンジンを初期化
        PhotoEffects.init(previewCanvas, img);

        // パラメータリセット
        ParamsUI.resetAll();

        // 画面遷移: ドロップゾーン → エディタ
        showEditor();
    }

    /**
     * パラメータ変更時: エフェクト適用 (rAF でバッチ)
     */
    function handleParamsChange(values) {
        if (renderPending) return;
        renderPending = true;

        requestAnimationFrame(() => {
            PhotoEffects.applyEffects(values);
            renderPending = false;
        });
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
        try {
            const values = ParamsUI.getValues();
            await navigator.clipboard.writeText(JSON.stringify(values));
            alert('パラメータをコピーしました');
        } catch (err) {
            console.error('Failed to copy params:', err);
            alert('コピーに失敗しました');
        }
    }

    /**
     * パラメータをクリップボードからペースト
     */
    async function handlePasteParams() {
        try {
            const text = await navigator.clipboard.readText();
            const values = JSON.parse(text);
            const success = ParamsUI.setValues(values);
            if (!success) {
                alert('無効なパラメータデータです');
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
