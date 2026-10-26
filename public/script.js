let projectsList = [];
let currentProjectIndex = null;
let currentSelectedFilePath = null;

let activePreviewProject = null;
let openPreviewTabs = [];
let currentActiveTabPath = null;
let currentBlobUrls = [];

document.addEventListener('DOMContentLoaded', () => {
    const singleFileInput = document.getElementById('htmlFileInput');
    const folderFileInput = document.getElementById('folderFileInput');

    if (singleFileInput) singleFileInput.addEventListener('change', handleSingleFileUpload);
    if (folderFileInput) folderFileInput.addEventListener('change', handleFolderUpload);

    // Fetch existing saved projects from MongoDB on load
    fetchProjectsFromDatabase();
});

// Fetch projects from MongoDB backend
async function fetchProjectsFromDatabase() {
    try {
        const response = await fetch('/api/projects');
        if (response.ok) {
            const data = await response.json();
            projectsList = data.map(p => ({
                id: p._id,
                name: p.title,
                type: Object.keys(p.filesMap || {}).length > 1 ? 'folder' : 'single',
                entryFile: p.entryHtml,
                files: p.filesMap || {}
            }));
            renderProjectGrid();
        }
    } catch (err) {
        console.error('Failed to load projects from database:', err);
    }
}

// Save project to MongoDB backend
async function saveProjectToDatabase(projectPayload) {
    try {
        const response = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: projectPayload.name,
                entryHtml: projectPayload.entryFile,
                filesMap: projectPayload.files
            })
        });
        if (response.ok) {
            const saved = await response.json();
            projectPayload.id = saved._id; // Assign MongoDB ID
            renderProjectGrid();
        }
    } catch (err) {
        console.error('Failed to save project to database:', err);
    }
}

// 1. Single HTML File Upload
function handleSingleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (e) {
        const project = {
            id: null,
            name: file.name.replace(/\.html?$/i, ''),
            type: 'single',
            entryFile: file.name,
            files: {
                [file.name]: { content: e.target.result, type: 'text', fileObj: file }
            }
        };
        projectsList.push(project);
        renderProjectGrid();
        await saveProjectToDatabase(project);
        event.target.value = '';
    };
    reader.readAsText(file);
}

// 2. Folder Upload with Relative Path Support
async function handleFolderUpload(event) {
    const files = Array.from(event.target.files);
    if (!files || files.length === 0) return;

    const firstPath = files[0].webkitRelativePath || files[0].name;
    const folderName = firstPath.split('/')[0] || 'Uploaded Project';

    const projectFiles = {};
    let entryFile = null;

    for (const file of files) {
        let relativePath = file.webkitRelativePath
            ? file.webkitRelativePath.split('/').slice(1).join('/') || file.name
            : file.name;

        relativePath = relativePath.replace(/\\/g, '/');

        if (/\.html?$/i.test(file.name)) {
            if (!entryFile || (file.name.toLowerCase() === 'index.html' && !relativePath.includes('/'))) {
                entryFile = relativePath;
            }
        }

        const isImage = /\.(png|jpe?g|gif|svg|webp|ico)$/i.test(file.name);
        if (isImage) {
            projectFiles[relativePath] = { content: URL.createObjectURL(file), type: 'image', fileObj: file };
        } else {
            const textContent = await readFileAsText(file);
            projectFiles[relativePath] = { content: textContent, type: 'text', fileObj: file };
        }
    }

    if (!entryFile) {
        entryFile = Object.keys(projectFiles).find(path => /\.html?$/i.test(path)) || Object.keys(projectFiles)[0];
    }

    const project = {
        id: null,
        name: folderName,
        type: 'folder',
        entryFile: entryFile,
        files: projectFiles
    };

    projectsList.push(project);
    renderProjectGrid();
    await saveProjectToDatabase(project);
    event.target.value = '';
}

function readFileAsText(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsText(file);
    });
}

// 3. Render Project Cards with Delete Button
function renderProjectGrid() {
    const grid = document.getElementById('projectGrid');
    if (!grid) return;

    if (projectsList.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #94a3b8;">No uploaded projects yet. Upload a file or folder above!</p>`;
        return;
    }

    grid.innerHTML = projectsList.map((project, index) => `
        <div class="project-card" style="background: #1e293b; border-radius: 12px; padding: 1.5rem; border: 1px solid #334155; display: flex; flex-direction: column; justify-content: space-between; gap: 1rem;">
            <div>
                <h3 style="color: #f8fafc; font-size: 1.2rem; margin-bottom: 0.5rem; display: flex; align-items: center; justify-content: space-between;">
                    <span style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="${project.type === 'folder' ? 'fa-solid fa-folder' : 'fa-solid fa-file-code'}" style="color: #38bdf8;"></i>
                        ${project.name}
                    </span>
                    <button onclick="deleteProject(${index})" title="Delete Project" style="background: transparent; color: #ef4444; border: none; cursor: pointer; font-size: 1rem; padding: 0.2rem 0.4rem;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </h3>
                <p style="color: #94a3b8; font-size: 0.875rem;">
                    Files: ${Object.keys(project.files).length} | Entry: <code style="color: #38bdf8;">${project.entryFile || 'N/A'}</code>
                </p>
            </div>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <button onclick="openLivePreview(${index})" class="btn-primary" style="padding: 0.5rem; font-size: 0.85rem; flex: 1;">
                    <i class="fa-solid fa-eye"></i> Preview
                </button>
                <button onclick="openCodeExplorer(${index})" style="padding: 0.5rem; font-size: 0.85rem; background: #334155; color: #fff; border: none; border-radius: 6px; cursor: pointer; flex: 1;">
                    <i class="fa-solid fa-code"></i> View Code
                </button>
                <button onclick="downloadProjectZip(${index})" style="padding: 0.5rem; font-size: 0.85rem; background: #2563eb; color: #fff; border: none; border-radius: 6px; cursor: pointer;" title="Download Folder Zip">
                    <i class="fa-solid fa-download"></i>
                </button>
            </div>
        </div>
    `).join('');
}

async function deleteProject(index) {
    const project = projectsList[index];
    if (!project) return;

    if (confirm(`Are you sure you want to delete "${project.name}"?`)) {
        try {
            if (project.id) {
                await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
            }
        } catch (err) {
            console.error('Failed to delete from database:', err);
        }

        projectsList.splice(index, 1);
        renderProjectGrid();
    }
}

// 4. Real-Time Tabbed Preview System (with linked-page exploration)
function resolveProjectPath(basePath, ref) {
    try {
        const clean = ref.replace(/\\/g, '/');
        const u = new URL(clean, 'http://project.local/' + basePath);
        return {
            path: decodeURIComponent(u.pathname.slice(1)),
            hash: u.hash
        };
    } catch (e) {
        return null;
    }
}

function findProjectFile(project, path) {
    if (!path) return null;
    if (project.files[path]) return path;
    const lower = path.toLowerCase();
    return Object.keys(project.files).find(p => p.toLowerCase() === lower) || null;
}

function resolveLink(project, path) {
    let hit = findProjectFile(project, path);
    if (hit) return hit;

    const p = (path || '').replace(/\/+$/, '');

    if (!p) {
        return findProjectFile(project, 'index.html') || project.entryFile || null;
    }

    const candidates = [p + '.html', p + '.htm', p + '/index.html'];
    for (const c of candidates) {
        hit = findProjectFile(project, c);
        if (hit) return hit;
    }

    const base = (p.split('/').pop() || '').toLowerCase();
    const names = Object.keys(project.files);
    const byName = names.filter(n => n.split('/').pop().toLowerCase() === base);
    if (byName.length) return byName[0];

    const byNameHtml = names.filter(n => {
        const b = n.split('/').pop().toLowerCase();
        return b === base + '.html' || b === base + '.htm';
    });
    return byNameHtml[0] || null;
}

const EXTERNAL_REF = /^(https?:|mailto:|tel:|data:|blob:|javascript:|#|\/\/)/i;

function revokeBlobUrls() {
    currentBlobUrls.forEach(u => URL.revokeObjectURL(u));
    currentBlobUrls = [];
}

function makeBlobUrl(content, mime) {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    currentBlobUrls.push(url);
    return url;
}

function buildAssetUrls(project) {
    const urls = {};

    Object.keys(project.files).forEach(p => {
        if (project.files[p].type === 'image') urls[p] = project.files[p].content;
    });

    Object.keys(project.files).forEach(p => {
        const f = project.files[p];
        if (f.type !== 'text' || /\.html?$/i.test(p)) return;

        let content = f.content;
        if (p.toLowerCase().endsWith('.css')) {
            content = content.replace(/url\(\s*['"]?([^'")]+?)['"]?\s*\)/g, (m, ref) => {
                if (EXTERNAL_REF.test(ref)) return m;
                const r = resolveProjectPath(p, ref);
                const target = r && resolveLink(project, r.path);
                return target && urls[target] ? `url("${urls[target]}")` : m;
            });
        }
        if (p.toLowerCase().endsWith('.js')) {
            content = rewriteNavigation(content);
        }
        urls[p] = makeBlobUrl(content, getMimeType(p));
    });

    return urls;
}

function openLivePreview(index, startFile) {
    const project = projectsList[index];
    if (!project || !project.entryFile) {
        alert('No HTML file found.');
        return;
    }

    const first = (startFile && project.files[startFile]) ? startFile : project.entryFile;

    activePreviewProject = project;
    openPreviewTabs = [first];

    document.getElementById('previewModal').style.display = 'block';
    switchPreviewTab(first);
}

function rewriteNavigation(code) {
    if (!code) return code;
    const toExplore = (m, q, ref) => EXTERNAL_REF.test(ref) ? m : `window.__explore(${q}${ref}${q})`;
    return code
        .replace(/(?:window\.|document\.|top\.|self\.|parent\.)?location(?:\.href)?\s*=\s*(['"])([^'"]+)\1/g, toExplore)
        .replace(/(?:window\.|document\.|top\.|self\.|parent\.)?location\.(?:assign|replace)\(\s*(['"])([^'"]+)\1\s*\)/g, toExplore)
        .replace(/window\.open\(\s*(['"])([^'"]+)\1[^)]*\)/g, toExplore);
}

window.addEventListener('message', (e) => {
    const iframe = document.getElementById('previewFrame');
    if (!iframe || e.source !== iframe.contentWindow) return;

    const d = e.data;
    if (!d || d.type !== 'project-explore') return;

    const project = activePreviewProject;
    if (!project) return;

    if (d.target) {
        switchPreviewTab(d.target, d.hash);
        return;
    }

    if (d.missing) {
        alert('Link not found in the uploaded files:\n' + d.missing + '\n\nMake sure that file is inside the uploaded folder.');
        return;
    }

    if (d.ref) {
        if (/^(https?:|\/\/)/i.test(d.ref)) {
            window.open(d.ref, '_blank', 'noopener');
            return;
        }
        const r = resolveProjectPath(currentActiveTabPath, d.ref);
        const target = r && resolveLink(project, r.path);
        if (target && /\.html?$/i.test(target)) {
            switchPreviewTab(target, r.hash);
        } else {
            console.warn('Could not resolve navigation target:', d.ref);
        }
    }
});

function switchPreviewTab(filePath, hash) {
    const project = activePreviewProject;
    if (!project || !project.files[filePath]) return;

    currentActiveTabPath = filePath;
    if (!openPreviewTabs.includes(filePath)) openPreviewTabs.push(filePath);
    renderPreviewTabsBar();

    revokeBlobUrls();
    const assetUrls = buildAssetUrls(project);

    const doc = new DOMParser().parseFromString(project.files[filePath].content || '', 'text/html');

    doc.querySelectorAll('[href], [src], [poster]').forEach(el => {
        ['href', 'src', 'poster'].forEach(attr => {
            const ref = el.getAttribute(attr);
            if (!ref || EXTERNAL_REF.test(ref)) return;

            const r = resolveProjectPath(filePath, ref);
            const target = r && resolveLink(project, r.path);
            if (!target) {
                if (el.tagName === 'A' && attr === 'href' && !/^www\./i.test(ref)) {
                    el.setAttribute('data-missing', ref);
                    el.setAttribute('href', '#');
                    el.removeAttribute('target');
                }
                return;
            }

            const isHtmlTarget = /\.html?$/i.test(target);
            if (isHtmlTarget && el.tagName === 'A') {
                el.setAttribute('data-explore', target);
                if (r.hash) el.setAttribute('data-hash', r.hash);
                el.setAttribute('href', '#');
                el.removeAttribute('target');
            } else if (assetUrls[target]) {
                el.setAttribute(attr, assetUrls[target]);
            }
        });
    });

    doc.querySelectorAll('style').forEach(styleEl => {
        styleEl.textContent = styleEl.textContent.replace(/url\(\s*['"]?([^'")]+?)['"]?\s*\)/g, (m, ref) => {
            if (EXTERNAL_REF.test(ref)) return m;
            const r = resolveProjectPath(filePath, ref);
            const target = r && resolveLink(project, r.path);
            return target && assetUrls[target] ? `url("${assetUrls[target]}")` : m;
        });
    });

    doc.querySelectorAll('[style]').forEach(el => {
        const s = el.getAttribute('style');
        if (!s || !s.includes('url(')) return;
        el.setAttribute('style', s.replace(/url\(\s*['"]?([^'")]+?)['"]?\s*\)/g, (m, ref) => {
            if (EXTERNAL_REF.test(ref)) return m;
            const r = resolveProjectPath(filePath, ref);
            const target = r && resolveLink(project, r.path);
            return target && assetUrls[target] ? `url("${assetUrls[target]}")` : m;
        }));
    });

    doc.querySelectorAll('script:not([src])').forEach(s => {
        s.textContent = rewriteNavigation(s.textContent);
    });
    doc.querySelectorAll('[onclick]').forEach(el => {
        el.setAttribute('onclick', rewriteNavigation(el.getAttribute('onclick')));
    });

    const bridge = doc.createElement('script');
    bridge.textContent = `
        window.__explore = function (r) {
            parent.postMessage({ type: 'project-explore', ref: r }, '*');
            return false;
        };
        document.addEventListener('click', function (e) {
            var a = e.target.closest ? e.target.closest('a') : null;
            if (!a) return;
            var t = a.getAttribute('data-explore');
            if (t) {
                e.preventDefault();
                parent.postMessage({ type: 'project-explore', target: t, hash: a.getAttribute('data-hash') || '' }, '*');
            } else if (a.getAttribute('data-missing')) {
                e.preventDefault();
                parent.postMessage({ type: 'project-explore', missing: a.getAttribute('data-missing') }, '*');
            } else if (a.getAttribute('href') === '#') {
                e.preventDefault();
            }
        }, true);
    `;
    const head = doc.head || doc.documentElement;
    head.insertBefore(bridge, head.firstChild);

    const html = '<!DOCTYPE html>' + doc.documentElement.outerHTML;
    const iframe = document.getElementById('previewFrame');

    iframe.onload = () => {
        if (!hash) return;
        try {
            const el = iframe.contentDocument.getElementById(hash.slice(1));
            if (el) el.scrollIntoView();
        } catch (err) { /* ignore */ }
    };

    iframe.src = makeBlobUrl(html, 'text/html');
}

function renderPreviewTabsBar() {
    const tabBar = document.getElementById('previewTabBar');
    if (!tabBar) return;

    tabBar.innerHTML = openPreviewTabs.map((filePath, i) => {
        const isActive = filePath === currentActiveTabPath;
        return `
            <div style="display: flex; align-items: center; background: ${isActive ? '#1e293b' : '#090d16'}; color: ${isActive ? '#f8fafc' : '#64748b'}; padding: 0.3rem 0.65rem; border-radius: 4px; font-size: 0.8rem; font-family: monospace; gap: 0.5rem; border: 1px solid ${isActive ? '#334155' : 'transparent'};">
                <span onclick="switchPreviewTabByIndex(${i})" style="cursor: pointer; display: flex; align-items: center; gap: 0.35rem;">
                    <i class="${getFileIcon(filePath)}" style="color: #38bdf8;"></i> ${filePath}
                </span>
                ${openPreviewTabs.length > 1 ? `<i class="fa-solid fa-xmark" onclick="closePreviewTab(event, ${i})" style="cursor: pointer; font-size: 0.7rem; padding: 2px;" title="Close"></i>` : ''}
            </div>
        `;
    }).join('');
}

function switchPreviewTabByIndex(i) {
    if (openPreviewTabs[i]) switchPreviewTab(openPreviewTabs[i]);
}

function closePreviewTab(event, index) {
    event.stopPropagation();
    const closing = openPreviewTabs[index];
    openPreviewTabs.splice(index, 1);

    if (closing === currentActiveTabPath && openPreviewTabs.length > 0) {
        switchPreviewTab(openPreviewTabs[Math.max(0, index - 1)]);
    } else {
        renderPreviewTabsBar();
    }
}

function closeModal() {
    document.getElementById('previewModal').style.display = 'none';
    document.getElementById('previewFrame').src = '';
    revokeBlobUrls();
    activePreviewProject = null;
    openPreviewTabs = [];
    currentActiveTabPath = null;
}

// 5. Minimalist Code Explorer
function openCodeExplorer(index) {
    currentProjectIndex = index;
    const project = projectsList[index];
    if (!project) return;

    const modal = document.getElementById('codeModal');
    const title = document.getElementById('codeModalTitle');
    const fileSidebar = document.getElementById('fileSidebar');

    title.innerText = project.name;

    fileSidebar.innerHTML = Object.keys(project.files).map((filePath, i) => `
        <div class="file-item" onclick="selectSourceFileByIndex(${i})" id="file-item-${filePath.replace(/[^a-zA-Z0-9]/g, '_')}" style="padding: 0.4rem 0.6rem; cursor: pointer; border-radius: 4px; font-family: monospace; font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.15rem; display: flex; align-items: center; gap: 0.5rem; transition: background 0.2s;">
            <i class="${getFileIcon(filePath)}" style="color: #38bdf8; font-size: 0.85rem;"></i>
            <span style="flex: 1;">${filePath}</span>
            ${/\.html?$/i.test(filePath) ? `<i class="fa-solid fa-eye" onclick="previewFromExplorer(event, ${i})" title="Preview this page" style="color: #38bdf8; font-size: 0.8rem; padding: 2px 4px;"></i>` : ''}
        </div>
    `).join('');

    modal.style.display = 'block';

    const fileToSelect = project.entryFile || Object.keys(project.files)[0];
    if (fileToSelect) selectSourceFile(fileToSelect);
}

function previewFromExplorer(event, i) {
    event.stopPropagation();
    const projectIndex = currentProjectIndex;
    const project = projectsList[projectIndex];
    if (!project) return;

    const path = Object.keys(project.files)[i];
    if (!path) return;

    closeCodeModal();
    openLivePreview(projectIndex, path);
}

function selectSourceFileByIndex(i) {
    const project = projectsList[currentProjectIndex];
    if (!project) return;
    const path = Object.keys(project.files)[i];
    if (path) selectSourceFile(path);
}

function selectSourceFile(filePath) {
    const project = projectsList[currentProjectIndex];
    if (!project || !project.files[filePath]) return;

    currentSelectedFilePath = filePath;
    const file = project.files[filePath];

    document.getElementById('currentFileName').innerText = filePath;

    document.querySelectorAll('.file-item').forEach(el => {
        el.style.background = 'transparent';
        el.style.color = '#94a3b8';
    });
    const activeEl = document.getElementById(`file-item-${filePath.replace(/[^a-zA-Z0-9]/g, '_')}`);
    if (activeEl) {
        activeEl.style.background = '#1e293b';
        activeEl.style.color = '#f8fafc';
    }

    const textarea = document.getElementById('codeEditorTextarea');
    const imageContainer = document.getElementById('imageViewerContainer');
    const imageBox = document.getElementById('imageViewerBox');
    const imageName = document.getElementById('imageViewerName');

    if (file.type === 'image') {
        textarea.style.display = 'none';
        imageContainer.style.display = 'block';
        imageBox.src = file.content;
        imageName.innerText = filePath;
    } else {
        imageContainer.style.display = 'none';
        textarea.style.display = 'block';
        textarea.value = file.content;
    }
}

function saveCurrentSourceFile() {
    if (currentProjectIndex === null || !currentSelectedFilePath) return;
    const project = projectsList[currentProjectIndex];
    if (!project || !project.files[currentSelectedFilePath]) return;

    const textarea = document.getElementById('codeEditorTextarea');
    if (project.files[currentSelectedFilePath].type === 'text') {
        project.files[currentSelectedFilePath].content = textarea.value;
        alert(`Saved changes to ${currentSelectedFilePath}!`);
    }
}

function downloadSelectedFile() {
    if (currentProjectIndex === null || !currentSelectedFilePath) {
        alert('No file selected.');
        return;
    }

    const project = projectsList[currentProjectIndex];
    const fileData = project.files[currentSelectedFilePath];
    if (!fileData) return;

    let blob;
    if (fileData.type === 'text') {
        const textarea = document.getElementById('codeEditorTextarea');
        const contentToDownload = (textarea.style.display !== 'none') ? textarea.value : fileData.content;
        blob = new Blob([contentToDownload], { type: getMimeType(currentSelectedFilePath) });
    } else if (fileData.fileObj) {
        blob = fileData.fileObj;
    } else {
        return;
    }

    const fileNameOnly = currentSelectedFilePath.split('/').pop();
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = fileNameOnly;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

function closeCodeModal() {
    document.getElementById('codeModal').style.display = 'none';
    currentProjectIndex = null;
    currentSelectedFilePath = null;
}

// 6. Download Project Zip
async function downloadProjectZip(index) {
    const project = projectsList[index];
    if (!project || typeof JSZip === 'undefined') return;

    const zip = new JSZip();
    for (const [filePath, fileData] of Object.entries(project.files)) {
        if (fileData.type === 'text') {
            zip.file(filePath, fileData.content);
        } else if (fileData.fileObj) {
            zip.file(filePath, fileData.fileObj);
        }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(zipBlob);
    downloadLink.download = `${project.name.replace(/\s+/g, '_')}_project.zip`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

function downloadCurrentProject() {
    if (currentProjectIndex !== null) downloadProjectZip(currentProjectIndex);
}

function getMimeType(filePath) {
    const p = filePath.toLowerCase();
    if (p.endsWith('.css')) return 'text/css';
    if (p.endsWith('.js')) return 'text/javascript';
    if (p.endsWith('.html') || p.endsWith('.htm')) return 'text/html';
    if (p.endsWith('.json')) return 'application/json';
    return 'text/plain';
}

function getFileIcon(filePath) {
    const p = filePath.toLowerCase();
    if (p.endsWith('.html') || p.endsWith('.htm')) return 'fa-solid fa-file-code';
    if (p.endsWith('.css')) return 'fa-solid fa-hashtag';
    if (p.endsWith('.js')) return 'fa-brands fa-js';
    if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(p)) return 'fa-solid fa-file-image';
    return 'fa-solid fa-file';
}