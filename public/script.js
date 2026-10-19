// Handle HTML file upload and live preview
const htmlFileInput = document.getElementById('htmlFileInput');
const previewModal = document.getElementById('previewModal');
const previewFrame = document.getElementById('previewFrame');
const modalTitle = document.getElementById('modalTitle');

if (htmlFileInput) {
    htmlFileInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const htmlContent = e.target.result;
                
                // Set modal content and load HTML into sandbox iframe
                modalTitle.textContent = `Preview: ${file.name}`;
                previewFrame.srcdoc = htmlContent;
                previewModal.style.display = 'flex';
            };
            reader.readAsText(file);
        }
    });
}

// Open static project description or preview demo
function openDemoModal(title, description) {
    modalTitle.textContent = title;
    previewFrame.srcdoc = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: sans-serif; padding: 2rem; color: #1e293b; text-align: center; }
                h2 { color: #2563eb; margin-bottom: 1rem; }
                p { color: #64748b; font-size: 1.1rem; }
            </style>
        </head>
        <body>
            <h2>${title}</h2>
            <p>${description}</p>
            <p style="margin-top: 2rem; font-size: 0.9rem; color: #94a3b8;">[Demo View Active - Use top navbar to upload your own custom HTML files]</p>
        </body>
        </html>
    `;
    previewModal.style.display = 'flex';
}

// Close preview modal
function closeModal() {
    previewModal.style.display = 'none';
    previewFrame.srcdoc = '';
    if (htmlFileInput) htmlFileInput.value = '';
}

// Close modal when clicking outside of content box
window.addEventListener('click', function(event) {
    if (event.target === previewModal) {
        closeModal();
    }
});