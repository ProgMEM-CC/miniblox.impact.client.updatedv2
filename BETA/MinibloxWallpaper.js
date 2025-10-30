// ==UserScript==
// @name         Miniblox.io Auto Wallpaper Rotator (v7.3 Themed Edition)
// @namespace    http://github.com/TheM1ddleM1n
// @description  smth here XD
// @author       Vicky_arut, TheM1ddleM1n
// @match        https://miniblox.io/
// @grant        none
// @run-at       document-start
// @version      7.3
// ==/UserScript==

(function() {
    'use strict';

    // === CONFIGURATION ===
    const CATEGORIES = {
        nature: [
            'https://images.unsplash.com/photo-1506744038136-46273834b3fb',
            'https://images.unsplash.com/photo-1501785888041-af3ef285b470',
            'https://images.unsplash.com/photo-1469474968028-56623f02e42e',
            'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee',
            'https://images.unsplash.com/photo-1521207418485-99c705420785'
        ],
        tech: [
            'https://images.unsplash.com/photo-1519389950473-47ba0277781c',
            'https://images.unsplash.com/photo-1550751827-4bd374c3f58b',
            'https://images.unsplash.com/photo-1518770660439-4636190af475',
            'https://images.unsplash.com/photo-1517430816045-df4b7de11d1d',
            'https://images.unsplash.com/photo-1518770660439-4636190af475'
        ],
        space: [
            'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa',
            'https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3',
            'https://images.unsplash.com/photo-1447433819943-74a20887a81e',
            'https://images.unsplash.com/photo-1476610182048-b716b8518aae',
            'https://images.unsplash.com/photo-1470225620780-dba8ba36b745'
        ],
        city: [
            'https://images.unsplash.com/photo-1508057198894-247b23fe5ade',
            'https://images.unsplash.com/photo-1502920514313-52581002a659',
            'https://images.unsplash.com/photo-1491553895911-0055eca6402d',
            'https://images.unsplash.com/photo-1508057198894-247b23fe5ade',
            'https://images.unsplash.com/photo-1533750349088-cd871a92f312'
        ],
        games: [
            'https://images.unsplash.com/photo-1616401784845-3cfae3b3c1be',
            'https://images.unsplash.com/photo-1620228885840-3d8d3c9f8263',
            'https://images.unsplash.com/photo-1603565816037-6d9a6f3e8a4c',
            'https://images.unsplash.com/photo-1612036782181-c67f26bde7f5',
            'https://images.unsplash.com/photo-1616401784845-3cfae3b3c1be'
        ],
        anime: [
            'https://images.unsplash.com/photo-1606112219348-204d7d8b94ee',
            'https://images.unsplash.com/photo-1623054784364-24e6f0d1a48d',
            'https://images.unsplash.com/photo-1624642586728-6fa1e4f98bd4',
            'https://images.unsplash.com/photo-1633496917011-3f6d79c9cb4b',
            'https://images.unsplash.com/photo-1606112219348-204d7d8b94ee'
        ]
    };

    const CATEGORY_KEYS = Object.keys(CATEGORIES);
    const INDEX_KEY = 'miniblox_wallpaper_index_v4';
    const CATEGORY_KEY = 'miniblox_wallpaper_category_v1';
    const CYCLE_MODE = true;
    const MAX_RETRIES = 3;

    // === SELECT CATEGORY AND IMAGE ===
    const lastCategoryIndex = parseInt(localStorage.getItem(CATEGORY_KEY) || '-1', 10);
    const nextCategoryIndex = (isNaN(lastCategoryIndex) ? 0 : (lastCategoryIndex + 1) % CATEGORY_KEYS.length);
    localStorage.setItem(CATEGORY_KEY, nextCategoryIndex.toString());

    const currentCategory = CATEGORY_KEYS[nextCategoryIndex];
    const currentList = CATEGORIES[currentCategory];

    let nextIndex;
    if (CYCLE_MODE) {
        const lastIndex = parseInt(localStorage.getItem(INDEX_KEY) || '-1', 10);
        nextIndex = (isNaN(lastIndex) ? 0 : (lastIndex + 1) % currentList.length);
    } else {
        nextIndex = Math.floor(Math.random() * currentList.length);
    }
    localStorage.setItem(INDEX_KEY, nextIndex.toString());

    let wallpaperUrl = `${currentList[nextIndex]}?auto=format&fit=crop&w=1920&h=1080&q=80`;

    // === PRELOAD CACHE ===
    const preloadImage = (url) => {
        const img = new Image();
        img.src = url;
    };
    currentList.forEach(preloadImage);

    // === VERIFY IMAGE ===
    async function verifyImage(url, retries = 0) {
        try {
            const res = await fetch(url, { method: 'HEAD' });
            if (res.ok) return url;
            throw new Error('Bad response');
        } catch {
            if (retries < MAX_RETRIES) {
                const fallback = currentList[Math.floor(Math.random() * currentList.length)];
                console.warn(`[Wallpaper Rotator] Failed to load ${url}, retrying with backup ${fallback}`);
                return verifyImage(fallback, retries + 1);
            } else {
                console.error('[Wallpaper Rotator] All fallbacks failed.');
                return 'https://picsum.photos/1920/1080';
            }
        }
    }

    // === MAIN EXECUTION ===
    verifyImage(wallpaperUrl).then((verifiedUrl) => {
        wallpaperUrl = verifiedUrl;

        const style = document.createElement('style');
        style.textContent = `
            body::before {
                content: '';
                position: fixed;
                top: 0; left: 0;
                width: 100%; height: 100%;
                background-image: url("${wallpaperUrl}") !important;
                background-size: cover !important;
                background-position: center center !important;
                background-repeat: no-repeat !important;
                aspect-ratio: 16/9;
                z-index: -1;
                transition: opacity 0.6s ease-in-out;
            }
            body {
                background: transparent !important;
            }
            img[src*="/assets/default-DKNlYibk.png"] {
                display: none !important;
            }
        `;
        (document.head || document.documentElement).prepend(style);

        // === DEBOUNCED MUTATION OBSERVER ===
        let debounceTimer;
        const applyFixes = () => {
            document.querySelectorAll('img').forEach(img => {
                if (img.src && img.src.includes('/assets/default-DKNlYibk.png')) {
                    img.src = wallpaperUrl;
                }
            });
            document.querySelectorAll('[style]').forEach(el => {
                const s = el.getAttribute('style');
                if (s && s.includes('default-DKNlYibk.png')) {
                    el.setAttribute('style', s.replace(/url\(([^)]+default-DKNlYibk\.png[^)]*)\)/g, `url("${wallpaperUrl}")`));
                }
            });
        };

        const observer = new MutationObserver(() => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(applyFixes, 200);
        });

        const startObserver = () => {
            observer.observe(document.documentElement || document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['src', 'style']
            });
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', startObserver, { once: true });
        } else {
            startObserver();
        }

        console.log(`%c[Miniblox Wallpaper Rotator]%c Loaded category: %c${currentCategory}%c →`,
            'color:#4CAF50;font-weight:bold;', 'color:inherit;', 'color:#03A9F4;font-weight:bold;', 'color:inherit;', wallpaperUrl);
    });
})();
