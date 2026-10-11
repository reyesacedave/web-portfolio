let allData = [];
let currentParentId = 'root';
let currentFolderName = '';

// Helper function to convert files to Base64 Data URL safely
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        let reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
    });
}

async function fetchItems() {
    try {
        let res = await fetch('/api/items');
        allData = await res.json();
        render();
    } catch (err) {
        console.error('Error fetching items:', err);
    }
}

async function loadProfilePhoto() {
    try {
        let res = await fetch('/api/profile-photo');
        let data = await res.json();
        if (data.photo) {
            document.getElementById('photo-box').innerHTML = '<img src="' + data.photo + '">';
        }
    } catch (err) {
        console.error('Error fetching profile photo:', err);
    }
}

function loadFiles() {
    fetchItems();
    loadProfilePhoto();
}

function triggerPhotoUpload() {
    document.getElementById('profile-photo-input').click();
}

async function previewImage(event) {
    let file = event.target.files[0];
    if (file) {
        let reader = new FileReader();
        reader.onload = async function(e) {
            let base64Photo = e.target.result;
            document.getElementById('photo-box').innerHTML = '<img src="' + base64Photo + '">';
            
            await fetch('/api/profile-photo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ photo: base64Photo })
            });
        };
        reader.readAsDataURL(file);
    }
}

function render() {
    let grid = document.getElementById('file-grid');
    document.getElementById('current-path').innerText = currentFolderName ? 'home / ' + currentFolderName : 'home';

    let currentItems = allData.filter(item => item.parentId === currentParentId);

    if (currentItems.length === 0) {
        grid.innerHTML = '<div class="empty-state">Folder is empty. Add files or drag & drop above!</div>';
        return;
    }

    let html = '';
    for (let i = 0; i < currentItems.length; i++) {
        let item = currentItems[i];
        let iconClass = item.type === 'folder' ? 'fa-folder folder-icon' : 'fa-file-lines file-icon';
        
        html += '<div onclick="clickItem(\'' + item._id + '\', \'' + item.type + '\', \'' + item.name + '\')" class="file-item">';
        html += '<div class="file-info"><i class="fa ' + iconClass + '"></i><span class="file-name">' + item.name + '</span></div>';
        html += '<div class="action-btns">';
        html += '<button class="download-btn" onclick="event.stopPropagation(); downloadItem(\'' + item._id + '\')"><i class="fa fa-download"></i></button>';
        html += '<button class="delete-btn" onclick="event.stopPropagation(); deleteItem(\'' + item._id + '\')"><i class="fa fa-trash"></i></button>';
        html += '</div>';
        html += '</div>';
    }
    grid.innerHTML = html;
}

async function downloadItem(id) {
    let item = allData.find(x => x._id === id);
    if (!item) return;

    if (item.type === 'file') {
        let a = document.createElement('a');
        a.href = item.content;
        a.download = item.name;
        a.click();
    } else if (item.type === 'folder') {
        let subFiles = allData.filter(x => x.parentId === item._id && x.type === 'file');
        if (subFiles.length === 0) {
            alert('This folder is empty.');
            return;
        }

        let zip = new JSZip();

        subFiles.forEach(file => {
            if (file.content && file.content.includes(',')) {
                let base64Data = file.content.split(',')[1];
                zip.file(file.name, base64Data, { base64: true });
            } else {
                zip.file(file.name, file.content || '');
            }
        });

        let zipBlob = await zip.generateAsync({ type: 'blob' });
        let url = URL.createObjectURL(zipBlob);
        let a = document.createElement('a');
        a.href = url;
        a.download = item.name + '.zip';
        a.click();
        URL.revokeObjectURL(url);
    }
}

function clickItem(id, type, name) {
    if (type === 'folder') {
        currentParentId = id;
        currentFolderName = name;
        render();
    } else {
        let found = allData.find(x => x._id === id);
        if (found.content && found.content.startsWith('data:image')) {
            alert('Image File: ' + found.name + '\n\nUse the download button to view full quality.');
        } else {
            alert('File Content:\n\n' + (found.content || '(This file is empty)'));
        }
    }
}

function goHome() {
    currentParentId = 'root';
    currentFolderName = '';
    render();
}

async function saveItemToDB(name, type, parentId, content) {
    try {
        let res = await fetch('/api/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, type, parentId, content })
        });
        return await res.json();
    } catch (err) {
        console.error('Error saving item:', err);
    }
}

async function handleFileUpload(event) {
    let files = event.target.files;
    for (let i = 0; i < files.length; i++) {
        let file = files[i];
        let base64Content = await readFileAsDataURL(file);
        await saveItemToDB(file.name, 'file', currentParentId, base64Content);
    }
    fetchItems();
    event.target.value = '';
}

async function handleFolderUpload(event) {
    let files = event.target.files;
    for (let i = 0; i < files.length; i++) {
        let file = files[i];
        let pathParts = file.webkitRelativePath.split('/');
        let folderName = pathParts[0];

        let existingFolder = allData.find(x => x.name === folderName && x.parentId === currentParentId && x.type === 'folder');
        let targetParentId = currentParentId;

        if (!existingFolder) {
            let newFolder = await saveItemToDB(folderName, 'folder', currentParentId, '');
            allData.push(newFolder);
            targetParentId = newFolder._id;
        } else {
            targetParentId = existingFolder._id;
        }

        let base64Content = await readFileAsDataURL(file);
        let fileName = pathParts[pathParts.length - 1];
        await saveItemToDB(fileName, 'file', targetParentId, base64Content);
    }
    fetchItems();
    event.target.value = '';
    alert('Folder uploaded successfully!');
}

async function handleDrop(event) {
    event.preventDefault();
    let items = event.dataTransfer.items;
    for (let i = 0; i < items.length; i++) {
        let item = items[i].webkitGetAsEntry();
        if (item) await processEntry(item, currentParentId);
    }
}

async function processEntry(entry, parentId) {
    if (entry.isFile) {
        entry.file(async function(file) {
            let base64Content = await readFileAsDataURL(file);
            await saveItemToDB(file.name, 'file', parentId, base64Content);
            fetchItems();
        });
    } else if (entry.isDirectory) {
        let newFolder = await saveItemToDB(entry.name, 'folder', parentId, '');
        allData.push(newFolder);
        let reader = entry.createReader();
        reader.readEntries(async function(entries) {
            for (let subEntry of entries) {
                await processEntry(subEntry, newFolder._id);
            }
        });
    }
}

async function deleteItem(id) {
    if (!confirm('Are you sure you want to delete this?')) return;
    try {
        let response = await fetch('/api/items/' + id, { method: 'DELETE' });
        if (response.ok) fetchItems();
    } catch (err) {
        console.error('Error deleting item:', err);
    }
}

loadFiles();