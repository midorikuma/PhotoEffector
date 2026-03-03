/**
 * dropzone.js — ドラッグ&ドロップ処理
 */

const Dropzone = (() => {
    'use strict';

    let dropzoneEl = null;
    let fileInputEl = null;
    let onImageLoaded = null;

    /**
     * ドロップゾーンを初期化
     * @param {Object} options
     * @param {string} options.dropzoneSelector - ドロップゾーン要素のID
     * @param {string} options.fileInputSelector - ファイル入力要素のID
     * @param {function} options.onLoad - 画像読み込み完了時コールバック (img: HTMLImageElement)
     */
    function init({ dropzoneSelector, fileInputSelector, onLoad }) {
        dropzoneEl = document.getElementById(dropzoneSelector);
        fileInputEl = document.getElementById(fileInputSelector);
        onImageLoaded = onLoad;

        if (!dropzoneEl || !fileInputEl) {
            console.error('Dropzone: required elements not found');
            return;
        }

        // ドラッグイベント
        dropzoneEl.addEventListener('dragenter', handleDragEnter);
        dropzoneEl.addEventListener('dragover', handleDragOver);
        dropzoneEl.addEventListener('dragleave', handleDragLeave);
        dropzoneEl.addEventListener('drop', handleDrop);

        // クリックでファイル選択
        dropzoneEl.addEventListener('click', (e) => {
            // label 内クリック時は label が処理するので無視
            if (e.target.tagName === 'LABEL' || e.target.tagName === 'INPUT') return;
            fileInputEl.click();
        });

        // ファイル入力変更
        fileInputEl.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                processFile(e.target.files[0]);
            }
        });

        // ページ全体へのドロップ防止
        document.addEventListener('dragover', (e) => e.preventDefault());
        document.addEventListener('drop', (e) => e.preventDefault());
    }

    function handleDragEnter(e) {
        e.preventDefault();
        e.stopPropagation();
        dropzoneEl.classList.add('drag-over');
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        dropzoneEl.classList.add('drag-over');
    }

    function handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        // relatedTarget がドロップゾーン内ならクラスを維持
        if (!dropzoneEl.contains(e.relatedTarget)) {
            dropzoneEl.classList.remove('drag-over');
        }
    }

    function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        dropzoneEl.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            processFile(files[0]);
        }
    }

    /**
     * ファイルを処理
     * @param {File} file
     */
    function processFile(file) {
        // 画像ファイルのバリデーション
        if (!file.type.startsWith('image/')) {
            alert('画像ファイルを選択してください。');
            return;
        }

        // ファイルサイズ制限 (50MB)
        if (file.size > 50 * 1024 * 1024) {
            alert('ファイルサイズが大きすぎます（50MB以下にしてください）。');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                if (onImageLoaded) {
                    onImageLoaded(img, file.name);
                }
            };
            img.onerror = () => {
                alert('画像を読み込めませんでした。');
            };
            img.src = e.target.result;
        };
        reader.onerror = () => {
            alert('ファイルの読み込みに失敗しました。');
        };
        reader.readAsDataURL(file);
    }

    return { init };
})();
