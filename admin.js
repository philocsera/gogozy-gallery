// ─────────────────────────────────────────────
// DB layer
// ─────────────────────────────────────────────
const DB_NAME    = 'gallery-db';
const DB_VERSION = 3;
let db;

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const idb = e.target.result;
            const oldVersion = e.oldVersion;
            if (oldVersion < 1) idb.createObjectStore('images', { keyPath: 'id', autoIncrement: true });
            if (oldVersion < 2) idb.createObjectStore('topics', { keyPath: 'id', autoIncrement: true });
            if (oldVersion < 3) {
                if (idb.objectStoreNames.contains('topics')) idb.deleteObjectStore('topics');
                idb.createObjectStore('topics', { keyPath: 'id', autoIncrement: true });
            }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror  = (e) => reject(e.target.error);
    });
}

function dbSaveImage(src, name, year, topic, title) {
    return new Promise((resolve, reject) => {
        const req = db.transaction('images', 'readwrite').objectStore('images')
                      .add({ src, name, year, topic, title: title || '' });
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror   = (e) => reject(e.target.error);
    });
}

function dbDeleteImage(id) {
    db.transaction('images', 'readwrite').objectStore('images').delete(id);
}

function dbUpdateImage(id, updates) {
    return new Promise((resolve, reject) => {
        const store = db.transaction('images', 'readwrite').objectStore('images');
        const getReq = store.get(id);
        getReq.onsuccess = (e) => {
            const record = Object.assign(e.target.result, updates);
            const putReq = db.transaction('images', 'readwrite').objectStore('images').put(record);
            putReq.onsuccess = () => resolve();
            putReq.onerror   = (e) => reject(e.target.error);
        };
        getReq.onerror = (e) => reject(e.target.error);
    });
}

function dbGetAllImages() {
    return new Promise((resolve, reject) => {
        const req = db.transaction('images', 'readonly').objectStore('images').getAll();
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror   = (e) => reject(e.target.error);
    });
}

function dbSaveTopic(name) {
    return new Promise((resolve, reject) => {
        const req = db.transaction('topics', 'readwrite').objectStore('topics').add({ name });
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror   = (e) => reject(e.target.error);
    });
}

function dbGetAllTopics() {
    return new Promise((resolve, reject) => {
        const req = db.transaction('topics', 'readonly').objectStore('topics').getAll();
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror   = (e) => reject(e.target.error);
    });
}

function dbClearImages() {
    return new Promise((resolve, reject) => {
        const req = db.transaction('images', 'readwrite').objectStore('images').clear();
        req.onsuccess = () => resolve();
        req.onerror   = (e) => reject(e.target.error);
    });
}

function dbClearTopics() {
    return new Promise((resolve, reject) => {
        const req = db.transaction('topics', 'readwrite').objectStore('topics').clear();
        req.onsuccess = () => resolve();
        req.onerror   = (e) => reject(e.target.error);
    });
}

function dbUpdateTopic(id, name) {
    return new Promise((resolve, reject) => {
        const store = db.transaction('topics', 'readwrite').objectStore('topics');
        const getReq = store.get(id);
        getReq.onsuccess = (e) => {
            const record = Object.assign(e.target.result, { name });
            const putReq = db.transaction('topics', 'readwrite').objectStore('topics').put(record);
            putReq.onsuccess = () => resolve();
            putReq.onerror   = (e) => reject(e.target.error);
        };
        getReq.onerror = (e) => reject(e.target.error);
    });
}

function dbDeleteTopic(id) {
    return new Promise((resolve, reject) => {
        const req = db.transaction('topics', 'readwrite').objectStore('topics').delete(id);
        req.onsuccess = () => resolve();
        req.onerror   = (e) => reject(e.target.error);
    });
}

async function ensureUnclassifiedTopic() {
    if (!topics.some(t => t.name === '미분류')) {
        const id = await dbSaveTopic('미분류');
        topics.push({ id, name: '미분류' });
    }
}

// ─────────────────────────────────────────────
// Topic order (localStorage)
// ─────────────────────────────────────────────
function getTopicOrder() {
    try { return JSON.parse(localStorage.getItem('topicOrder') || '[]'); } catch { return []; }
}

function saveTopicOrder(ids) {
    localStorage.setItem('topicOrder', JSON.stringify(ids));
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
let images        = [];
let topics        = [];
let stagedFiles   = [];
let lightboxDbId  = null;
let editingDbId   = null;
let managingTopic = null;

let filterYear  = 'all';
let filterTopic = 'all';
let uploadYear  = null;
let uploadTopic = null;

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
// Navigation
// ─────────────────────────────────────────────
function navigateTo(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const target = document.getElementById('page-' + pageId);
    if (target) target.classList.add('active');
    document.querySelectorAll(`[data-page="${pageId}"]`).forEach(l => l.classList.add('active'));
    if (pageId === 'manage') renderTopicOrderList();
}

document.querySelectorAll('[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(link.dataset.page);
    });
});

// ─────────────────────────────────────────────
// Gallery — filter bars
// ─────────────────────────────────────────────
document.getElementById('year-filter-bar').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-year]');
    if (!btn) return;
    filterYear = btn.dataset.year;
    filterTopic = 'all';
    renderGallery();
});

document.getElementById('topic-filter-bar').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-topic]');
    if (!btn) return;
    filterTopic = btn.dataset.topic;
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
    const usedTopicNames = new Set(images.map(img => img.topic));
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
// Gallery — rendering
// ─────────────────────────────────────────────
function getFilteredImages() {
    return images.filter(img => {
        const yearOk  = filterYear  === 'all' || img.year  === filterYear;
        const topicOk = filterTopic === 'all' || img.topic === filterTopic;
        return yearOk && topicOk;
    });
}

function renderGallery() {
    const gallery = document.getElementById('gallery');
    const empty   = document.getElementById('gallery-empty');
    gallery.innerHTML = '';

    const filtered = getFilteredImages();
    filtered.forEach(img => gallery.appendChild(createGalleryItem(img)));

    empty.classList.toggle('visible', filtered.length === 0);
    renderYearFilterBar();
    renderTopicFilterBar();
}

function createGalleryItem(image) {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.dataset.dbid = image.dbId;

    const img = document.createElement('img');
    img.src = image.src;
    img.alt = image.name;

    const overlay = document.createElement('div');
    overlay.className = 'overlay';

    const meta = document.createElement('div');
    meta.className = 'overlay-meta';

    const tags = document.createElement('div');
    tags.className = 'overlay-tags';
    [image.year, image.topic].forEach(text => {
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

    const editBtn = document.createElement('button');
    editBtn.title = '수정';
    editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
    editBtn.addEventListener('click', (e) => { e.stopPropagation(); openEditModal(image.dbId); });

    const deleteBtn = document.createElement('button');
    deleteBtn.title = '삭제';
    deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dbDeleteImage(image.dbId);
        images = images.filter(img => img.dbId !== image.dbId);
        renderGallery();
    });

    btns.appendChild(viewBtn);
    btns.appendChild(editBtn);
    btns.appendChild(deleteBtn);
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
// Upload — year selection
// ─────────────────────────────────────────────
document.getElementById('upload-year-pills').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-upload-year]');
    if (!btn) return;
    uploadYear = btn.dataset.uploadYear;
    document.querySelectorAll('#upload-year-pills .pill').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    validateUpload();
});

// ─────────────────────────────────────────────
// Upload — topic selection
// ─────────────────────────────────────────────
function renderUploadTopicPills() {
    const container = document.getElementById('upload-topic-pills');
    container.innerHTML = '';

    getSortedTopics().forEach(t => {
        const btn = document.createElement('button');
        btn.className = 'pill' + (uploadTopic === t.name ? ' active' : '');
        btn.dataset.uploadTopic = t.name;
        btn.textContent = t.name;
        btn.addEventListener('click', () => {
            uploadTopic = t.name;
            document.querySelectorAll('#upload-topic-pills .pill:not(.pill-add)').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            validateUpload();
        });
        container.appendChild(btn);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'pill pill-add';
    addBtn.textContent = '+ 추가';
    addBtn.addEventListener('click', openTopicModal);
    container.appendChild(addBtn);
}

// ─────────────────────────────────────────────
// Upload — drag & drop / file staging
// ─────────────────────────────────────────────
const dropZone  = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');

dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    stageFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', () => { stageFiles(fileInput.files); fileInput.value = ''; });

function stageFiles(files) {
    Array.from(files).filter(f => f.type.startsWith('image/')).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const entry = { dataUrl: e.target.result, fileName: file.name };
            stagedFiles.push(entry);
            addStagedPreview(entry);
            validateUpload();
        };
        reader.readAsDataURL(file);
    });
}

function addStagedPreview(entry) {
    const preview = document.getElementById('staged-preview');
    const item = document.createElement('div');
    item.className = 'staged-item';

    const img = document.createElement('img');
    img.src = entry.dataUrl;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'staged-remove';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
        stagedFiles = stagedFiles.filter(f => f !== entry);
        item.remove();
        validateUpload();
    });

    item.appendChild(img);
    item.appendChild(removeBtn);
    preview.appendChild(item);
}

// ─────────────────────────────────────────────
// Upload — submit
// ─────────────────────────────────────────────
function validateUpload() {
    document.getElementById('upload-btn').disabled = !(uploadYear && uploadTopic && stagedFiles.length > 0);
}

document.getElementById('upload-btn').addEventListener('click', async () => {
    if (!uploadYear || !uploadTopic || stagedFiles.length === 0) return;

    const title = document.getElementById('upload-title').value.trim();

    for (const { dataUrl, fileName } of stagedFiles) {
        const dbId = await dbSaveImage(dataUrl, fileName, uploadYear, uploadTopic, title);
        images.push({ dbId, src: dataUrl, name: fileName, year: uploadYear, topic: uploadTopic, title });
    }

    renderGallery();
    stagedFiles = [];
    document.getElementById('staged-preview').innerHTML = '';
    document.getElementById('upload-title').value = '';
    uploadYear  = null;
    uploadTopic = null;
    document.querySelectorAll('#upload-year-pills .pill').forEach(p => p.classList.remove('active'));
    renderUploadTopicPills();
    validateUpload();
    navigateTo('gallery');
});

// ─────────────────────────────────────────────
// Manage — export / import
// ─────────────────────────────────────────────
function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

document.getElementById('export-btn').addEventListener('click', async () => {
    const btn = document.getElementById('export-btn');
    btn.disabled = true;

    const allImages = await dbGetAllImages();
    const CHUNK_SIZE = 75 * 1024 * 1024; // 75MB per chunk

    // 이미지를 청크로 분할
    const chunks = [];
    let currentChunk = [];
    let currentSize  = 0;

    for (const img of allImages) {
        const entry   = { src: img.src, name: img.name, year: img.year, topic: img.topic, title: img.title || '' };
        const entrySize = img.src.length;
        if (currentSize + entrySize > CHUNK_SIZE && currentChunk.length > 0) {
            chunks.push(currentChunk);
            currentChunk = [];
            currentSize  = 0;
        }
        currentChunk.push(entry);
        currentSize += entrySize;
    }
    if (currentChunk.length > 0) chunks.push(currentChunk);

    // data-index.json 다운로드
    downloadJSON({
        version: 1,
        chunks:  chunks.length,
        topics:  getSortedTopics().map(({ name }) => ({ name })),
    }, 'data-index.json');

    // data-chunk-N.json 다운로드 (0.5초 간격)
    for (let i = 0; i < chunks.length; i++) {
        await new Promise(r => setTimeout(r, 500));
        btn.textContent = `내보내기 (${i + 1}/${chunks.length})`;
        downloadJSON({ images: chunks[i] }, `data-chunk-${i}.json`);
    }

    btn.textContent = '내보내기';
    btn.disabled    = false;
});

document.getElementById('import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    let data;
    try { data = JSON.parse(await file.text()); }
    catch { alert('올바른 백업 파일이 아닙니다.'); return; }

    if (!confirm(`불러오기를 진행하면 기존 데이터가 모두 삭제됩니다.\n이미지 ${data.images?.length ?? 0}장, 주제 ${data.topics?.length ?? 0}개를 복원합니다.\n계속하시겠습니까?`)) return;

    const progress = document.getElementById('import-progress');
    const bar      = document.getElementById('import-bar');
    const statusEl = document.getElementById('import-status');
    progress.classList.remove('hidden');
    bar.style.width = '0%';

    statusEl.textContent = '기존 데이터 삭제 중...';
    await Promise.all([dbClearImages(), dbClearTopics()]);
    images = []; topics = [];

    statusEl.textContent = '주제 복원 중...';
    for (const { name } of (data.topics ?? [])) {
        const id = await dbSaveTopic(name);
        topics.push({ id, name });
    }
    saveTopicOrder(topics.map(t => t.id));

    const total = data.images?.length ?? 0;
    for (let i = 0; i < total; i++) {
        const { src, name, year, topic, title } = data.images[i];
        const dbId = await dbSaveImage(src, name, year, topic, title);
        images.push({ dbId, src, name, year: year || '기타', topic: topic || '기타', title: title || '' });
        bar.style.width = ((i + 1) / total * 100) + '%';
        statusEl.textContent = `이미지 복원 중... (${i + 1}/${total})`;
    }

    statusEl.textContent = `완료! 이미지 ${total}장, 주제 ${topics.length}개 복원됨.`;
    renderGallery();
    renderUploadTopicPills();
    renderTopicOrderList();
});

// ─────────────────────────────────────────────
// Manage — topic order
// ─────────────────────────────────────────────
function renderTopicOrderList() {
    const list = document.getElementById('topic-order-list');
    if (!list) return;
    list.innerHTML = '';

    getSortedTopics().forEach(topic => {
        const li = document.createElement('li');
        li.className = 'topic-order-item';
        li.draggable = true;
        li.dataset.id = topic.id;

        const handle = document.createElement('span');
        handle.className = 'drag-handle';
        handle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/></svg>`;

        const count = images.filter(i => i.topic === topic.name).length;
        const name = document.createElement('span');
        name.className = 'topic-order-name';
        name.textContent = `${topic.name} (${count})`;

        const manageBtn = document.createElement('button');
        manageBtn.className = 'topic-order-manage-btn';
        manageBtn.title = '수정/삭제';
        manageBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
        manageBtn.addEventListener('click', () => openTopicManageModal(topic));

        li.appendChild(handle);
        li.appendChild(name);
        li.appendChild(manageBtn);
        list.appendChild(li);
    });

    let dragSrc = null;

    list.querySelectorAll('.topic-order-item').forEach(item => {
        item.addEventListener('dragstart', (e) => {
            dragSrc = item;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            list.querySelectorAll('.topic-order-item').forEach(i => i.classList.remove('drag-over'));
            const newOrder = [...list.querySelectorAll('.topic-order-item')].map(i => parseInt(i.dataset.id));
            saveTopicOrder(newOrder);
            renderTopicFilterBar();
            renderUploadTopicPills();
            if (editingDbId !== null) renderEditTopicPills();
        });
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (item !== dragSrc) {
                list.querySelectorAll('.topic-order-item').forEach(i => i.classList.remove('drag-over'));
                item.classList.add('drag-over');
            }
        });
        item.addEventListener('drop', (e) => {
            e.preventDefault();
            if (!dragSrc || dragSrc === item) return;
            const items = [...list.querySelectorAll('.topic-order-item')];
            const srcIdx = items.indexOf(dragSrc);
            const tgtIdx = items.indexOf(item);
            list.insertBefore(dragSrc, srcIdx < tgtIdx ? item.nextSibling : item);
        });
    });
}

// ─────────────────────────────────────────────
// Topic manage modal
// ─────────────────────────────────────────────
function openTopicManageModal(topic) {
    managingTopic = topic;
    document.getElementById('topic-manage-input').value = topic.name;
    document.getElementById('topic-manage-modal').classList.remove('hidden');
    document.getElementById('topic-manage-input').focus();
    document.getElementById('topic-manage-input').select();
}

function closeTopicManageModal() {
    document.getElementById('topic-manage-modal').classList.add('hidden');
    managingTopic = null;
}

document.getElementById('topic-manage-cancel').addEventListener('click', closeTopicManageModal);
document.getElementById('topic-manage-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('topic-manage-modal')) closeTopicManageModal();
});

document.getElementById('topic-manage-confirm').addEventListener('click', async () => {
    if (!managingTopic) return;
    const newName = document.getElementById('topic-manage-input').value.trim();
    if (!newName || newName === managingTopic.name) { closeTopicManageModal(); return; }
    if (topics.some(t => t.name === newName)) { closeTopicManageModal(); return; }

    const oldName = managingTopic.name;
    await dbUpdateTopic(managingTopic.id, newName);

    const topicObj = topics.find(t => t.id === managingTopic.id);
    if (topicObj) topicObj.name = newName;

    for (const img of images.filter(i => i.topic === oldName)) {
        await dbUpdateImage(img.dbId, { topic: newName });
        img.topic = newName;
    }

    if (filterTopic === oldName) filterTopic = newName;

    closeTopicManageModal();
    renderGallery();
    renderUploadTopicPills();
    renderTopicOrderList();
    if (editingDbId !== null) renderEditTopicPills();
});

document.getElementById('topic-manage-delete').addEventListener('click', async () => {
    if (!managingTopic) return;
    const oldName = managingTopic.name;

    await ensureUnclassifiedTopic();

    for (const img of images.filter(i => i.topic === oldName)) {
        await dbUpdateImage(img.dbId, { topic: '미분류' });
        img.topic = '미분류';
    }

    await dbDeleteTopic(managingTopic.id);
    saveTopicOrder(getTopicOrder().filter(id => id !== managingTopic.id));
    topics = topics.filter(t => t.id !== managingTopic.id);

    if (filterTopic === oldName) filterTopic = 'all';

    closeTopicManageModal();
    renderGallery();
    renderUploadTopicPills();
    renderTopicOrderList();
    if (editingDbId !== null) renderEditTopicPills();
});

document.getElementById('topic-manage-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  document.getElementById('topic-manage-confirm').click();
    if (e.key === 'Escape') closeTopicManageModal();
});

// ─────────────────────────────────────────────
// Edit modal
// ─────────────────────────────────────────────
function openEditModal(dbId) {
    editingDbId = dbId;
    const image = images.find(img => img.dbId === dbId);
    if (!image) return;

    document.getElementById('edit-title').value = image.title || '';
    document.querySelectorAll('#edit-year-pills .pill').forEach(p => {
        p.classList.toggle('active', p.dataset.editYear === image.year);
    });
    renderEditTopicPills(image.topic);
    document.getElementById('edit-modal').classList.remove('hidden');
    document.getElementById('edit-title').focus();
}

function renderEditTopicPills(selectedTopic) {
    const container = document.getElementById('edit-topic-pills');
    if (selectedTopic === undefined) {
        const cur = container.querySelector('.pill.active');
        selectedTopic = cur ? cur.dataset.editTopic : null;
    }
    container.innerHTML = '';
    getSortedTopics().forEach(t => {
        const btn = document.createElement('button');
        btn.className = 'pill' + (t.name === selectedTopic ? ' active' : '');
        btn.dataset.editTopic = t.name;
        btn.textContent = t.name;
        btn.addEventListener('click', () => {
            container.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
        });
        container.appendChild(btn);
    });
    const addBtn = document.createElement('button');
    addBtn.className = 'pill pill-add';
    addBtn.textContent = '+ 추가';
    addBtn.addEventListener('click', openTopicModal);
    container.appendChild(addBtn);
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.add('hidden');
    editingDbId = null;
}

document.getElementById('edit-year-pills').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-edit-year]');
    if (!btn) return;
    document.querySelectorAll('#edit-year-pills .pill').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
});

document.getElementById('edit-cancel').addEventListener('click', closeEditModal);
document.getElementById('edit-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('edit-modal')) closeEditModal();
});

document.getElementById('edit-confirm').addEventListener('click', async () => {
    if (!editingDbId) return;

    const title    = document.getElementById('edit-title').value.trim();
    const yearBtn  = document.querySelector('#edit-year-pills .pill.active');
    const topicBtn = document.querySelector('#edit-topic-pills .pill.active');

    const updates = { title };
    if (yearBtn)  updates.year  = yearBtn.dataset.editYear;
    if (topicBtn) updates.topic = topicBtn.dataset.editTopic;

    await dbUpdateImage(editingDbId, updates);

    const image = images.find(img => img.dbId === editingDbId);
    if (image) Object.assign(image, updates);

    closeEditModal();
    renderGallery();
});

document.getElementById('edit-title').addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  document.getElementById('edit-confirm').click();
    if (e.key === 'Escape') closeEditModal();
});

// ─────────────────────────────────────────────
// Topic modal
// ─────────────────────────────────────────────
function openTopicModal() {
    document.getElementById('topic-input').value = '';
    document.getElementById('topic-modal').classList.remove('hidden');
    document.getElementById('topic-input').focus();
}

function closeTopicModal() {
    document.getElementById('topic-modal').classList.add('hidden');
}

document.getElementById('topic-cancel').addEventListener('click', closeTopicModal);
document.getElementById('topic-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('topic-modal')) closeTopicModal();
});

document.getElementById('topic-confirm').addEventListener('click', async () => {
    const name = document.getElementById('topic-input').value.trim();
    if (!name) return;
    if (topics.some(t => t.name === name)) { closeTopicModal(); return; }

    const id = await dbSaveTopic(name);
    topics.push({ id, name });
    closeTopicModal();
    renderUploadTopicPills();
    renderTopicOrderList();
    if (editingDbId !== null) renderEditTopicPills();
});

document.getElementById('topic-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  document.getElementById('topic-confirm').click();
    if (e.key === 'Escape') closeTopicModal();
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
// Init
// ─────────────────────────────────────────────
async function init() {
    const loading = document.getElementById('gallery-loading');
    db = await openDB();

    const [storedImages, storedTopics] = await Promise.all([dbGetAllImages(), dbGetAllTopics()]);

    topics = storedTopics;
    storedImages.forEach(({ id, src, name, year, topic, title }) => {
        images.push({ dbId: id, src, name, year: year || '기타', topic: topic || '기타', title: title || '' });
    });

    loading.classList.add('hidden');
    renderGallery();
    renderUploadTopicPills();
}

init();
