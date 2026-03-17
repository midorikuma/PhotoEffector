/**
 * layers.js — レイヤー管理モジュール
 */

const LayerManager = (() => {
    'use strict';

    let layers = [];
    let activeLayerId = null;
    let canvas = null;
    let ctx = null;
    let onChangeCallback = null;

    // レイヤーIDカウンタ
    let nextLayerId = 1;

    /**
     * 初期化
     */
    function init(targetCanvas, callback) {
        canvas = targetCanvas;
        ctx = canvas.getContext('2d', { willReadFrequently: true });
        onChangeCallback = callback;
        layers = [];
        activeLayerId = null;
        nextLayerId = 1;
    }

    /**
     * 新しいレイヤーを追加
     */
    function addLayer(img, fileName) {
        // キャンバスサイズが未設定なら最初の画像に合わせる
        if (layers.length === 0) {
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
        }

        const id = `layer-${nextLayerId++}`;
        const newLayer = {
            id,
            name: fileName || `Layer ${nextLayerId - 1}`,
            image: img,
            params: { ...ParamsUI.EFFECT_PARAMS.reduce((acc, p) => ({ ...acc, [p.key]: p.defaultVal }), {}) },
            opacity: 1.0,
            blendMode: 'source-over',
            visible: true,
            // このレイヤー専用のオフスクリーンキャンバス
            offscreen: document.createElement('canvas'),
            needsUpdate: true // エフェクト再計算が必要か
        };

        newLayer.offscreen.width = canvas.width;
        newLayer.offscreen.height = canvas.height;

        // 追加されたら最前面（配列の最後）に
        layers.push(newLayer);
        activeLayerId = id;

        _notifyChange();
        return id;
    }

    /**
     * アクティブレイヤーのIDを取得
     */
    function getActiveLayerId() {
        return activeLayerId;
    }

    /**
     * アクティブレイヤーを設定
     */
    function setActiveLayer(id) {
        if (layers.find(l => l.id === id)) {
            activeLayerId = id;
            _notifyChange();
        }
    }

    /**
     * アクティブレイヤーのパラメータを取得
     */
    function getActiveParams() {
        const layer = layers.find(l => l.id === activeLayerId);
        return layer ? { ...layer.params } : null;
    }

    /**
     * アクティブレイヤーのパラメータを更新
     */
    function updateActiveParams(newParams) {
        const layer = layers.find(l => l.id === activeLayerId);
        if (layer) {
            layer.params = { ...layer.params, ...newParams };
            layer.needsUpdate = true;
            _notifyChange(false); // UIの再構築は不要、描画のみ更新
        }
    }

    /**
     * レイヤーのプロパティ（可視性、不透明度、合成モード）を更新
     */
    function updateLayerProperty(id, prop, value) {
        const layer = layers.find(l => l.id === id);
        if (layer) {
            layer[prop] = value;
            _notifyChange(false);
        }
    }

    /**
     * レイヤーの削除
     */
    function removeLayer(id) {
        layers = layers.filter(l => l.id !== id);
        if (activeLayerId === id) {
            activeLayerId = layers.length > 0 ? layers[layers.length - 1].id : null;
        }

        if (layers.length === 0) {
            ctx.clearRect(0, 0, canvas.width, canvas.height); // 全レイヤー削除時
        }

        _notifyChange();
    }

    /**
     * レイヤー順序の入れ替え (index1 と index2)
     */
    function swapLayers(idx1, idx2) {
        if (idx1 >= 0 && idx1 < layers.length && idx2 >= 0 && idx2 < layers.length) {
            const temp = layers[idx1];
            layers[idx1] = layers[idx2];
            layers[idx2] = temp;
            _notifyChange();
        }
    }

    /**
     * すべてのレイヤーを取得
     */
    function getLayers() {
        return layers;
    }

    /**
     * 変更を通知（UI更新＋再描画トリガー）
     */
    function _notifyChange(rebuildUI = true) {
        if (onChangeCallback) {
            onChangeCallback(rebuildUI);
        }
    }

    return {
        init,
        addLayer,
        getActiveLayerId,
        setActiveLayer,
        getActiveParams,
        updateActiveParams,
        updateLayerProperty,
        removeLayer,
        swapLayers,
        getLayers
    };
})();
