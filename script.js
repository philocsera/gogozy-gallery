// ─────────────────────────────────────────────
// Topic order (localStorage)
// ─────────────────────────────────────────────
function getTopicOrder() {
    try { return JSON.parse(localStorage.getItem('topicOrder') || '[]'); } catch { return []; }
}

function getSortedTopics() {
    const order = getTopicOrder();
    if (!order.length) return [...topics];
    const ordered = order.map(id => topics.find(t => t.id === id)).filter(Boolean);
    topics.forEach(t => { if (!order.includes(t.id)) ordered.push(t); });
    return ordered;
}

// ─────────────────────────────────────────────
// App state
// ─────────────────────────────────────────────
let images       = [];
let topics       = [];
let lightboxDbId = null;
let pickingDbId  = null;

let filterYear  = 'all';
let filterTopic = 'all';

const PAGE_SIZE = 60;
let displayCount = PAGE_SIZE;

// 사용자 주제 오버라이드 (localStorage)
let userTopicOverrides = {};

function loadUserOverrides() {
    try { userTopicOverrides = JSON.parse(localStorage.getItem('userTopicOverrides') || '{}'); }
    catch { userTopicOverrides = {}; }
}

function saveUserOverrides() {
    localStorage.setItem('userTopicOverrides', JSON.stringify(userTopicOverrides));
}

function getEffectiveTopic(image) {
    return userTopicOverrides[image.dbId] || image.topic;
}

// ─────────────────────────────────────────────
// Theme toggle
// ─────────────────────────────────────────────
function applyTheme(theme) {
    document.body.classList.toggle('light', theme === 'light');
}

document.getElementById('theme-toggle').addEventListener('click', () => {
    const next = document.body.classList.contains('light') ? 'dark' : 'light';
    localStorage.setItem('theme', next);
    applyTheme(next);
});

applyTheme(localStorage.getItem('theme') || 'light');

// ─────────────────────────────────────────────
// Splash screen
// ─────────────────────────────────────────────
(function () {
    const splash = document.getElementById('splash');
    setTimeout(() => splash.classList.add('fade-out'), 1800);
    setTimeout(() => splash.remove(), 2500);
})();

// ─────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────
function navigateTo(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const target = document.getElementById('page-' + pageId);
    if (target) target.classList.add('active');
    document.querySelectorAll(`[data-page="${pageId}"]`).forEach(l => l.classList.add('active'));
}

document.querySelectorAll('[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(link.dataset.page);
    });
});

// ─────────────────────────────────────────────
// Filter bars
// ─────────────────────────────────────────────
document.getElementById('year-filter-bar').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-year]');
    if (!btn) return;
    filterYear = btn.dataset.year;
    filterTopic = 'all';
    displayCount = PAGE_SIZE;
    renderGallery();
});

document.getElementById('topic-filter-bar').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-topic]');
    if (!btn) return;
    filterTopic = btn.dataset.topic;
    displayCount = PAGE_SIZE;
    renderGallery();
});

function renderYearFilterBar() {
    const bar = document.getElementById('year-filter-bar');
    bar.innerHTML = '';

    const years = [...new Set(images.map(i => i.year))].sort();

    const allBtn = document.createElement('button');
    allBtn.className = 'pill' + (filterYear === 'all' ? ' active' : '');
    allBtn.dataset.year = 'all';
    allBtn.textContent = `전체 (${images.length})`;
    bar.appendChild(allBtn);

    years.forEach(year => {
        const count = images.filter(i => i.year === year).length;
        const btn = document.createElement('button');
        btn.className = 'pill' + (filterYear === year ? ' active' : '');
        btn.dataset.year = year;
        btn.textContent = `${year} (${count})`;
        bar.appendChild(btn);
    });
}

function renderTopicFilterBar() {
    const bar = document.getElementById('topic-filter-bar');
    const usedTopicNames = new Set(images.map(img => getEffectiveTopic(img)));
    const displayTopics = getSortedTopics().filter(t => usedTopicNames.has(t.name));

    bar.innerHTML = '';

    const yearFiltered = filterYear === 'all' ? images : images.filter(i => i.year === filterYear);
    const allBtn = document.createElement('button');
    allBtn.className = 'pill' + (filterTopic === 'all' ? ' active' : '');
    allBtn.dataset.topic = 'all';
    allBtn.textContent = `전체 (${yearFiltered.length})`;
    bar.appendChild(allBtn);

    displayTopics.forEach((topic) => {
        const count = yearFiltered.filter(i => i.topic === topic.name).length;
        if (count === 0) return;
        const btn = document.createElement('button');
        btn.className = 'pill' + (filterTopic === topic.name ? ' active' : '');
        btn.dataset.topic = topic.name;
        btn.textContent = `${topic.name} (${count})`;
        bar.appendChild(btn);
    });
}

// ─────────────────────────────────────────────
// Gallery rendering
// ─────────────────────────────────────────────
function getFilteredImages() {
    return images.filter(img => {
        const yearOk  = filterYear  === 'all' || img.year === filterYear;
        const topicOk = filterTopic === 'all' || getEffectiveTopic(img) === filterTopic;
        return yearOk && topicOk;
    });
}

function renderGallery() {
    const gallery = document.getElementById('gallery');
    const empty   = document.getElementById('gallery-empty');
    gallery.innerHTML = '';

    const filtered = getFilteredImages();
    const toShow   = filtered.slice(0, displayCount);
    toShow.forEach(img => gallery.appendChild(createGalleryItem(img)));

    if (filtered.length > displayCount) {
        const remaining = filtered.length - displayCount;
        const moreBtn = document.createElement('button');
        moreBtn.className = 'load-more-btn';
        moreBtn.textContent = `더 보기 (${remaining}장 남음)`;
        moreBtn.addEventListener('click', () => {
            displayCount += PAGE_SIZE;
            renderGallery();
        });
        gallery.appendChild(moreBtn);
    }

    empty.classList.toggle('visible', filtered.length === 0);
    renderYearFilterBar();
    renderTopicFilterBar();
}

function createGalleryItem(image) {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.dataset.dbid = image.dbId;

    const img = document.createElement('img');
    img.src     = image.src;
    img.alt     = image.name;
    img.loading = 'lazy';

    const overlay = document.createElement('div');
    overlay.className = 'overlay';

    const meta = document.createElement('div');
    meta.className = 'overlay-meta';

    const effectiveTopic = getEffectiveTopic(image);

    const tags = document.createElement('div');
    tags.className = 'overlay-tags';
    [image.year, effectiveTopic].forEach(text => {
        const tag = document.createElement('span');
        tag.className = 'overlay-tag';
        tag.textContent = text;
        tags.appendChild(tag);
    });

    const btns = document.createElement('div');
    btns.className = 'overlay-btns';

    const viewBtn = document.createElement('button');
    viewBtn.title = '크게 보기';
    viewBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>`;
    viewBtn.addEventListener('click', (e) => { e.stopPropagation(); openLightbox(image.dbId); });

    btns.appendChild(viewBtn);

    if (effectiveTopic === '미분류') {
        const pickBtn = document.createElement('button');
        pickBtn.title = '주제 지정';
        pickBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`;
        pickBtn.addEventListener('click', (e) => { e.stopPropagation(); openTopicPickModal(image.dbId); });
        btns.appendChild(pickBtn);
    }
    meta.appendChild(tags);
    meta.appendChild(btns);
    overlay.appendChild(meta);
    item.appendChild(img);
    item.appendChild(overlay);

    if (image.title) {
        const caption = document.createElement('div');
        caption.className = 'gallery-caption';
        caption.textContent = image.title;
        item.appendChild(caption);
    }

    item.addEventListener('click', () => openLightbox(image.dbId));
    return item;
}

// ─────────────────────────────────────────────
// 미분류 주제 지정 모달
// ─────────────────────────────────────────────
function openTopicPickModal(dbId) {
    pickingDbId = dbId;
    const container = document.getElementById('topic-pick-pills');
    container.innerHTML = '';

    getSortedTopics()
        .filter(t => t.name !== '미분류')
        .forEach(t => {
            const btn = document.createElement('button');
            btn.className = 'pill';
            btn.textContent = t.name;
            btn.addEventListener('click', () => {
                userTopicOverrides[pickingDbId] = t.name;
                saveUserOverrides();
                closeTopicPickModal();
                renderGallery();
            });
            container.appendChild(btn);
        });

    document.getElementById('topic-pick-modal').classList.remove('hidden');
}

function closeTopicPickModal() {
    document.getElementById('topic-pick-modal').classList.add('hidden');
    pickingDbId = null;
}

document.getElementById('topic-pick-cancel').addEventListener('click', closeTopicPickModal);
document.getElementById('topic-pick-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('topic-pick-modal')) closeTopicPickModal();
});

// ─────────────────────────────────────────────
// Lightbox
// ─────────────────────────────────────────────
function openLightbox(dbId) {
    lightboxDbId = dbId;
    const image = images.find(img => img.dbId === dbId);
    if (image) {
        document.getElementById('lightbox-img').src = image.src;
        document.getElementById('lightbox').classList.remove('hidden');
    }
}

function closeLightbox() {
    document.getElementById('lightbox').classList.add('hidden');
}

function navigateLightbox(direction) {
    const filtered = getFilteredImages();
    const idx = filtered.findIndex(img => img.dbId === lightboxDbId);
    if (idx === -1) return;
    const next = filtered[(idx + direction + filtered.length) % filtered.length];
    lightboxDbId = next.dbId;
    document.getElementById('lightbox-img').src = next.src;
}

document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
document.getElementById('lightbox-prev').addEventListener('click', () => navigateLightbox(-1));
document.getElementById('lightbox-next').addEventListener('click', () => navigateLightbox(1));
document.getElementById('lightbox').addEventListener('click', (e) => {
    if (e.target === document.getElementById('lightbox')) closeLightbox();
});
document.addEventListener('keydown', (e) => {
    if (document.getElementById('lightbox').classList.contains('hidden')) return;
    if (e.key === 'Escape')      closeLightbox();
    if (e.key === 'ArrowLeft')   navigateLightbox(-1);
    if (e.key === 'ArrowRight')  navigateLightbox(1);
});

// ─────────────────────────────────────────────
// Init — metadata.json에서 로드 후 이미지는 lazy load
// ─────────────────────────────────────────────
async function init() {
    const loading = document.getElementById('gallery-loading');
    loadUserOverrides();

    try {
        const res = await fetch('./metadata.json');
        if (!res.ok) throw new Error('metadata.json not found');
        const data = await res.json();

        topics = (data.topics || []).map((t, i) => ({ id: i + 1, name: t.name }));

        (data.images || []).forEach((img, i) => {
            images.push({
                dbId:  i + 1,
                src:   `./images/${img.file}`,
                name:  img.file,
                year:  img.year  || '기타',
                topic: img.topic || '기타',
                title: img.title || '',
            });
        });
    } catch (e) {
        console.warn('데이터 로드 실패:', e.message);
    }

    loading.classList.add('hidden');
    renderGallery();
}

init();
