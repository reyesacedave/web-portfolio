const htmlFileInput = document.getElementById('htmlFileInput');
const folderFileInput = document.getElementById('folderFileInput');
const projectGrid = document.getElementById('projectGrid');
const previewModal = document.getElementById('previewModal');
const previewFrame = document.getElementById('previewFrame');
const modalTitle = document.getElementById('modalTitle');

const uploadedProjectsMap = new Map();

window.addEventListener('DOMContentLoaded', fetchProjects);

// Fetch saved projects from MongoDB
async function fetchProjects() {
    try {
        const response = await fetch('/api/projects');
        if (!response.ok) return;
        const projects = await response.json();
        
        projects.forEach((proj, idx) => {
            renderProjectCard(proj._id, proj.title, proj.entryHtml, proj.filesMap || {}, projects.length - idx);
        });
    } catch (err) {
        console.error('Error fetching projects:', err);
    }
}

// Single File Upload Listener
if (htmlFileInput) {
    htmlFileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            const content = event.target.result;
            const name = file.name.replace(/\.[^/.]+$/, "");
            const filesMap = { [file.name]: { content: content, isImage: false } };

            saveAndRenderProject(name, content, filesMap);
            htmlFileInput.value = '';
        };
        reader.readAsText(file);
    });
}

// Folder Upload Listener
if (folderFileInput) {
    folderFileInput.addEventListener('change', async function(e) {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const filesMap = {};
        let entryHtmlName = '';
        let folderName = files[0].webkitRelativePath.split('/')[0] || "Project Folder";

        for (const file of files) {
            const relativePath = file.webkitRelativePath.substring(folderName.length + 1);
            if (!relativePath) continue;

            const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|gif|svg|webp|ico)$/i.test(relativePath);

            if (isImage) {
                const dataUrl = await readFileAsDataURL(file);
                filesMap[relativePath] = { content: dataUrl, isImage: true };
            } else {
                const textContent = await readFileAsText(file);
                filesMap[relativePath] = { content: textContent, isImage: false };

                if (relativePath.toLowerCase() === 'index.html' || (!entryHtmlName && relativePath.toLowerCase().endsWith('.html'))) {
                    entryHtmlName = relativePath;
                }
            }
        }

        if (!entryHtmlName) {
            alert('No HTML file found in uploaded folder.');
            return;
        }

        const stitchedHtml = buildStitchedHtml(filesMap, entryHtmlName);
        saveAndRenderProject(folderName, stitchedHtml, filesMap);
        folderFileInput.value = '';
    });
}

function readFileAsText(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsText(file);
    });
}

function readFileAsDataURL(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
    });
}

// Inline styles, scripts, and image data into entry HTML for iframe rendering
function buildStitchedHtml(filesMap, entryPoint) {
    let html = filesMap[entryPoint]?.content || '';

    // Inline CSS
    html = html.replace(/<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi, (match, href) => {
        const cleanPath = href.replace(/^\.\//, '');
        if (filesMap[cleanPath] && !filesMap[cleanPath].isImage) {
            return `<style>\n/* Inlined: ${cleanPath} */\n${filesMap[cleanPath].content}\n</style>`;
        }
        return match;
    });

    // Inline JS
    html = html.replace(/<script\s+[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi, (match, src) => {
        const cleanPath = src.replace(/^\.\//, '');
        if (filesMap[cleanPath] && !filesMap[cleanPath].isImage) {
            return `<script>\n/* Inlined: ${cleanPath} */\n${filesMap[cleanPath].content}\n</script>`;
        }
        return match;
    });

    // Inline Image Data URLs
    html = html.replace(/<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi, (match, src) => {
        const cleanPath = src.replace(/^\.\//, '');
        if (filesMap[cleanPath] && filesMap[cleanPath].isImage) {
            return match.replace(src, filesMap[cleanPath].content);
        }
        return match;
    });

    return html;
}

// Save to Backend / Render Card
async function saveAndRenderProject(title, entryHtml, filesMap) {
    const tempId = 'local_' + Date.now();
    renderProjectCard(tempId, title, entryHtml, filesMap, 'New');

    try {
        const response = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, entryHtml, filesMap })
        });

        if (response.ok) {
            const saved = await response.json();
            const card = document.getElementById(tempId);
            if (card) {
                card.id = saved._id;
                uploadedProjectsMap.delete(tempId);
                uploadedProjectsMap.set(saved._id, { title, entryHtml, filesMap });

                const deleteBtn = card.querySelector('.btn-delete-card');
                if (deleteBtn) deleteBtn.setAttribute('onclick', `deleteProject('${saved._id}')`);
                const viewBtn = card.querySelector('.btn-view');
                if (viewBtn) viewBtn.setAttribute('onclick', `openUploadedById('${saved._id}')`);
                const codeBtn = card.querySelector('.btn-code');
                if (codeBtn) codeBtn.setAttribute('onclick', `openCodeById('${saved._id}')`);
            }
        }
    } catch (err) {
        console.log('Running in local session fallback mode.');
    }
}

// Render Project Card
function renderProjectCard(id, title, entryHtml, filesMap, num) {
    uploadedProjectsMap.set(id, { title, entryHtml, filesMap });

    const newCard = document.createElement('div');
    newCard.className = 'project-card';
    newCard.id = id;

    const fileCount = Object.keys(filesMap).length;
    const badgeLabel = fileCount > 1 ? `${fileCount} Files` : 'HTML';

    newCard.innerHTML = `
        <button class="btn-delete-card" onclick="deleteProject('${id}')" title="Delete Project"><i class="fa-solid fa-trash"></i></button>
        <div class="project-thumbnail"><i class="fa-solid fa-file-code preview-icon" style="color: #2563eb;"></i></div>
        <div class="project-info">
            <span class="project-number">PROJECT 0${num}</span>
            <h3>${title}</h3>
            <p>Standalone web project.</p>
            <div class="tech-badges">
                <span class="badge">${badgeLabel}</span>
                <span class="badge">Uploaded</span>
            </div>
            <div class="project-status completed">Ready</div>
            <div class="project-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <button class="btn-view" onclick="openUploadedById('${id}')" style="flex: 1;">View Project</button>
                <button class="btn-view btn-code" onclick="openCodeById('${id}')" style="flex: 1; background: #334155;">View Code</button>
            </div>
        </div>
    `;

    if (projectGrid) projectGrid.prepend(newCard);
}

// Open Live Site Preview
window.openUploadedById = function(id) {
    const data = uploadedProjectsMap.get(id);
    if (data) {
        modalTitle.textContent = `Live Site Preview: ${data.title}`;
        previewFrame.srcdoc = data.entryHtml;
        previewModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
};

// Open Code & Asset Explorer (Explicitly bound globally)
window.openCodeById = function(id) {
    const data = uploadedProjectsMap.get(id);
    if (!data) return;

    const codeModal = document.getElementById('codeModal');
    const codeModalTitle = document.getElementById('codeModalTitle');
    const fileSidebar = document.getElementById('fileSidebar');
    const codeContainer = document.getElementById('codeViewerContainer');
    const codeViewerBox = document.getElementById('codeViewerBox');
    const imageContainer = document.getElementById('imageViewerContainer');
    const imageViewerBox = document.getElementById('imageViewerBox');
    const imageViewerName = document.getElementById('imageViewerName');

    if (!codeModal) return;

    codeModalTitle.textContent = `Source Code: ${data.title}`;
    fileSidebar.innerHTML = '';

    const files = Object.keys(data.filesMap || {});

    if (files.length === 0) {
        codeContainer.style.display = 'block';
        imageContainer.style.display = 'none';
        codeViewerBox.textContent = data.entryHtml || '';
    } else {
        files.forEach((filename, index) => {
            const item = document.createElement('div');
            item.className = `file-item ${index === 0 ? 'active' : ''}`;
            
            const fileData = data.filesMap[filename];
            let iconClass = 'fa-file-code';

            if (fileData.isImage || /\.(png|jpe?g|gif|svg|webp|ico)$/i.test(filename)) iconClass = 'fa-file-image';
            else if (filename.endsWith('.css')) iconClass = 'fa-file-lines';
            else if (filename.endsWith('.js')) iconClass = 'fa-brands fa-js';
            else if (filename.endsWith('.html')) iconClass = 'fa-html5';

            item.innerHTML = `<i class="fa-solid ${iconClass}"></i> ${filename}`;
            item.onclick = () => {
                document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');

                if (fileData.isImage) {
                    codeContainer.style.display = 'none';
                    imageContainer.style.display = 'block';
                    imageViewerBox.src = fileData.content;
                    imageViewerName.textContent = filename;
                } else {
                    imageContainer.style.display = 'none';
                    codeContainer.style.display = 'block';
                    codeViewerBox.textContent = typeof fileData === 'object' ? fileData.content : fileData;
                }
            };
            fileSidebar.appendChild(item);
        });

        // Display first file
        const firstFile = files[0];
        const firstData = data.filesMap[firstFile];
        if (firstData.isImage) {
            codeContainer.style.display = 'none';
            imageContainer.style.display = 'block';
            imageViewerBox.src = firstData.content;
            imageViewerName.textContent = firstFile;
        } else {
            imageContainer.style.display = 'none';
            codeContainer.style.display = 'block';
            codeViewerBox.textContent = typeof firstData === 'object' ? firstData.content : firstData;
        }
    }

    codeModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
};

window.closeCodeModal = function() {
    const codeModal = document.getElementById('codeModal');
    if (codeModal) {
        codeModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
};

window.closeModal = function() {
    previewModal.style.display = 'none';
    previewFrame.srcdoc = '';
    document.body.style.overflow = 'auto';
};

// Delete Project
window.deleteProject = async function(id) {
    try {
        if (!id.toString().startsWith('local_')) {
            await fetch(`/api/projects/${id}`, { method: 'DELETE' });
        }
        const card = document.getElementById(id);
        if (card) {
            card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.9)';
            setTimeout(() => {
                card.remove();
                uploadedProjectsMap.delete(id);
            }, 300);
        }
    } catch (err) {
        console.error('Error deleting project:', err);
    }
};