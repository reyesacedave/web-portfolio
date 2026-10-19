// Store uploaded HTML contents safely in memory by ID
const uploadedProjectsMap = new Map();

const htmlFileInput = document.getElementById('htmlFileInput');
const projectGrid = document.getElementById('projectGrid');
const previewModal = document.getElementById('previewModal');
const previewFrame = document.getElementById('previewFrame');
const modalTitle = document.getElementById('modalTitle');

let projectCounter = 3;

if (htmlFileInput) {
    htmlFileInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const htmlContent = e.target.result;
                const projectName = file.name.replace(/\.[^/.]+$/, ""); // Strip file extension
                const cardId = `uploaded-project-${Date.now()}`;

                // Store content safely in map
                uploadedProjectsMap.set(cardId, {
                    title: projectName,
                    content: htmlContent
                });

                // Create clean project card element
                const newCard = document.createElement('div');
                newCard.className = 'project-card';
                newCard.id = cardId;
                
                newCard.innerHTML = `
                    <button class="btn-delete-card" onclick="deleteProject('${cardId}')" title="Delete Project"><i class="fa-solid fa-trash"></i></button>
                    <div class="project-thumbnail"><i class="fa-solid fa-file-code preview-icon" style="color: #2563eb;"></i></div>
                    <div class="project-info">
                        <span class="project-number">PROJECT 0${projectCounter++}</span>
                        <h3>${projectName}</h3>
                        <p>Description</p>
                        <div class="tech-badges">
                            <span class="badge">HTML</span>
                            <span class="badge">Uploaded</span>
                        </div>
                        <div class="project-status completed">Ready</div>
                        <div class="project-actions">
                            <button class="btn-view" onclick="openUploadedById('${cardId}')">View Project</button>
                        </div>
                    </div>
                `;

                // Add card to project grid container
                if (projectGrid) {
                    projectGrid.prepend(newCard);
                }
                
                // Reset file input
                htmlFileInput.value = '';
            };
            reader.readAsText(file);
        }
    });
}

// Open fullscreen modal using stored content ID
function openUploadedById(cardId) {
    const data = uploadedProjectsMap.get(cardId);
    if (data) {
        modalTitle.textContent = `Live Site Preview: ${data.title}`;
        previewFrame.srcdoc = data.content;
        previewModal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Lock background scrolling
    }
}

// Open static project demo modal in fullscreen
function openDemoModal(title, description) {
    modalTitle.textContent = title;
    previewFrame.srcdoc = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: 'Segoe UI', sans-serif; padding: 4rem 2rem; color: #1e293b; text-align: center; background-color: #f8fafc; }
                .container { max-width: 600px; margin: 0 auto; background: white; padding: 3rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
                h2 { color: #2563eb; margin-bottom: 1rem; }
                p { color: #64748b; font-size: 1.1rem; line-height: 1.6; }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>${title}</h2>
                <p>${description}</p>
            </div>
        </body>
        </html>
    `;
    previewModal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Lock background scrolling
}

// Close full screen modal
function closeModal() {
    previewModal.style.display = 'none';
    previewFrame.srcdoc = '';
    document.body.style.overflow = 'auto'; // Restore background scrolling
}

// Function to delete a project card
function deleteProject(cardId) {
    const card = document.getElementById(cardId);
    if (card) {
        card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.9)';
        setTimeout(() => {
            card.remove();
            uploadedProjectsMap.delete(cardId);
        }, 300);
    }
}