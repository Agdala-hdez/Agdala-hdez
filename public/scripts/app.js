class PhotoEditor {
    constructor() {
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.currentTool = 'select';
        this.isDrawing = false;
        this.currentImage = null;
        this.currentFilename = null;
        this.history = [];
        this.historyStep = -1;
        this.zoom = 1;
        this.layers = [];
        this.currentLayer = 0;
        
        this.initializeEventListeners();
        this.setupCanvas();
    }

    initializeEventListeners() {
        // File upload
        const fileInput = document.getElementById('fileInput');
        const selectFileBtn = document.getElementById('selectFileBtn');
        const uploadArea = document.getElementById('uploadArea');

        selectFileBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => this.handleFileUpload(e));

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#007acc';
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.borderColor = '#555';
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#555';
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.uploadFile(files[0]);
            }
        });

        // Tool selection
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTool = btn.dataset.tool;
                this.updateCursor();
            });
        });

        // Canvas events
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());

        // Filter controls
        this.setupFilterControls();

        // Transform controls
        this.setupTransformControls();

        // Zoom controls
        this.setupZoomControls();

        // Save and download
        document.getElementById('saveBtn').addEventListener('click', () => this.saveCanvas());
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadImage());

        // History controls
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('redoBtn').addEventListener('click', () => this.redo());

        // Layer controls
        document.getElementById('addLayerBtn').addEventListener('click', () => this.addLayer());

        // Property updates
        this.setupPropertyControls();
    }

    setupCanvas() {
        this.canvas.width = 800;
        this.canvas.height = 600;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.updateCanvasInfo();
    }

    updateCanvasInfo() {
        document.getElementById('canvasSize').textContent = `${this.canvas.width} x ${this.canvas.height}`;
    }

    updateCursor() {
        const cursors = {
            select: 'default',
            brush: 'crosshair',
            eraser: 'crosshair',
            text: 'text',
            crop: 'crosshair',
            shapes: 'crosshair'
        };
        this.canvas.style.cursor = cursors[this.currentTool] || 'default';
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (file) {
            await this.uploadFile(file);
        }
    }

    async uploadFile(file) {
        this.showLoading(true);
        
        const formData = new FormData();
        formData.append('image', file);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            if (result.success) {
                this.currentFilename = result.image.filename;
                await this.loadImageToCanvas(result.image.path);
                document.getElementById('uploadArea').classList.add('hidden');
            } else {
                alert('Error al subir la imagen: ' + result.error);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error al subir la imagen');
        } finally {
            this.showLoading(false);
        }
    }

    async loadImageToCanvas(imagePath) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                this.canvas.width = img.width;
                this.canvas.height = img.height;
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                this.ctx.drawImage(img, 0, 0);
                this.currentImage = img;
                this.saveState();
                this.updateCanvasInfo();
                resolve();
            };
            img.src = imagePath;
        });
    }

    setupFilterControls() {
        // Range sliders
        const sliders = ['brightness', 'contrast', 'saturation', 'blur'];
        sliders.forEach(slider => {
            const element = document.getElementById(slider);
            const valueSpan = element.nextElementSibling;
            
            element.addEventListener('input', (e) => {
                valueSpan.textContent = e.target.value;
                this.applyFilter(slider, e.target.value);
            });
        });

        // Filter buttons
        document.querySelectorAll('[data-filter]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.target.dataset.filter;
                this.applyFilter(filter);
            });
        });
    }

    async applyFilter(filter, value = null) {
        if (!this.currentFilename) {
            alert('Primero debes cargar una imagen');
            return;
        }

        this.showLoading(true);

        try {
            const response = await fetch('/api/filter', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    filename: this.currentFilename,
                    filter: filter,
                    value: value
                })
            });

            const result = await response.json();
            
            if (result.success) {
                await this.loadImageToCanvas(result.processedImage);
            } else {
                alert('Error al aplicar filtro: ' + result.error);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error al aplicar filtro');
        } finally {
            this.showLoading(false);
        }
    }

    setupTransformControls() {
        // Resize
        document.getElementById('resizeBtn').addEventListener('click', async () => {
            const width = document.getElementById('width').value;
            const height = document.getElementById('height').value;
            
            if (!width || !height) {
                alert('Ingresa ancho y alto');
                return;
            }
            
            await this.resizeImage(width, height);
        });

        // Rotate
        document.querySelectorAll('[data-rotate]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const angle = parseInt(e.target.dataset.rotate);
                await this.rotateImage(angle);
            });
        });
    }

    async resizeImage(width, height) {
        if (!this.currentFilename) {
            alert('Primero debes cargar una imagen');
            return;
        }

        this.showLoading(true);

        try {
            const response = await fetch('/api/resize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    filename: this.currentFilename,
                    width: width,
                    height: height
                })
            });

            const result = await response.json();
            
            if (result.success) {
                await this.loadImageToCanvas(result.processedImage);
            } else {
                alert('Error al redimensionar: ' + result.error);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error al redimensionar');
        } finally {
            this.showLoading(false);
        }
    }

    async rotateImage(angle) {
        if (!this.currentFilename) {
            alert('Primero debes cargar una imagen');
            return;
        }

        this.showLoading(true);

        try {
            const response = await fetch('/api/rotate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    filename: this.currentFilename,
                    angle: angle
                })
            });

            const result = await response.json();
            
            if (result.success) {
                await this.loadImageToCanvas(result.processedImage);
            } else {
                alert('Error al rotar: ' + result.error);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error al rotar');
        } finally {
            this.showLoading(false);
        }
    }

    setupZoomControls() {
        document.getElementById('zoomIn').addEventListener('click', () => {
            this.zoom = Math.min(this.zoom * 1.2, 5);
            this.updateZoom();
        });

        document.getElementById('zoomOut').addEventListener('click', () => {
            this.zoom = Math.max(this.zoom / 1.2, 0.1);
            this.updateZoom();
        });

        document.getElementById('fitToScreen').addEventListener('click', () => {
            this.fitToScreen();
        });
    }

    updateZoom() {
        this.canvas.style.transform = `scale(${this.zoom})`;
        document.getElementById('zoomLevel').textContent = `${Math.round(this.zoom * 100)}%`;
    }

    fitToScreen() {
        const container = document.getElementById('canvasContainer');
        const containerRect = container.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();
        
        const scaleX = (containerRect.width - 40) / this.canvas.width;
        const scaleY = (containerRect.height - 40) / this.canvas.height;
        
        this.zoom = Math.min(scaleX, scaleY, 1);
        this.updateZoom();
    }

    setupPropertyControls() {
        // Brush size
        const brushSize = document.getElementById('brushSize');
        const brushSizeValue = brushSize.nextElementSibling;
        
        brushSize.addEventListener('input', (e) => {
            brushSizeValue.textContent = e.target.value + 'px';
        });

        // Opacity
        const opacity = document.getElementById('opacity');
        const opacityValue = opacity.nextElementSibling;
        
        opacity.addEventListener('input', (e) => {
            opacityValue.textContent = e.target.value + '%';
        });
    }

    startDrawing(e) {
        if (this.currentTool === 'brush' || this.currentTool === 'eraser') {
            this.isDrawing = true;
            const rect = this.canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / this.zoom;
            const y = (e.clientY - rect.top) / this.zoom;
            
            this.ctx.beginPath();
            this.ctx.moveTo(x, y);
            
            if (this.currentTool === 'eraser') {
                this.ctx.globalCompositeOperation = 'destination-out';
            } else {
                this.ctx.globalCompositeOperation = 'source-over';
                this.ctx.strokeStyle = document.getElementById('colorPicker').value;
            }
            
            this.ctx.lineWidth = document.getElementById('brushSize').value;
            this.ctx.lineCap = 'round';
            this.ctx.globalAlpha = document.getElementById('opacity').value / 100;
        }
    }

    draw(e) {
        if (!this.isDrawing) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.zoom;
        const y = (e.clientY - rect.top) / this.zoom;
        
        // Update mouse position display
        document.getElementById('mousePos').textContent = `${Math.round(x)}, ${Math.round(y)}`;
        
        if (this.currentTool === 'brush' || this.currentTool === 'eraser') {
            this.ctx.lineTo(x, y);
            this.ctx.stroke();
        }
    }

    stopDrawing() {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.globalAlpha = 1;
            this.saveState();
        }
    }

    saveState() {
        this.historyStep++;
        if (this.historyStep < this.history.length) {
            this.history.length = this.historyStep;
        }
        this.history.push(this.canvas.toDataURL());
        this.updateHistoryPanel();
    }

    updateHistoryPanel() {
        const historyPanel = document.querySelector('.history-panel');
        historyPanel.innerHTML = '';
        
        this.history.forEach((state, index) => {
            const item = document.createElement('div');
            item.className = 'history-item';
            if (index === this.historyStep) {
                item.classList.add('active');
            }
            item.textContent = `Estado ${index + 1}`;
            item.addEventListener('click', () => this.restoreState(index));
            historyPanel.appendChild(item);
        });
    }

    restoreState(step) {
        if (step >= 0 && step < this.history.length) {
            this.historyStep = step;
            const img = new Image();
            img.onload = () => {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                this.ctx.drawImage(img, 0, 0);
                this.updateHistoryPanel();
            };
            img.src = this.history[step];
        }
    }

    undo() {
        if (this.historyStep > 0) {
            this.restoreState(this.historyStep - 1);
        }
    }

    redo() {
        if (this.historyStep < this.history.length - 1) {
            this.restoreState(this.historyStep + 1);
        }
    }

    addLayer() {
        const layersPanel = document.querySelector('.layers-panel');
        const layerCount = layersPanel.querySelectorAll('.layer-item').length;
        
        const newLayer = document.createElement('div');
        newLayer.className = 'layer-item';
        newLayer.innerHTML = `
            <i class="fas fa-eye"></i>
            <span>Capa ${layerCount + 1}</span>
            <div class="layer-opacity">
                <input type="range" min="0" max="100" value="100">
            </div>
        `;
        
        // Remove active class from other layers
        layersPanel.querySelectorAll('.layer-item').forEach(item => {
            item.classList.remove('active');
        });
        
        newLayer.classList.add('active');
        layersPanel.insertBefore(newLayer, document.getElementById('addLayerBtn'));
        
        // Add event listeners
        newLayer.addEventListener('click', () => {
            layersPanel.querySelectorAll('.layer-item').forEach(item => {
                item.classList.remove('active');
            });
            newLayer.classList.add('active');
        });
    }

    async saveCanvas() {
        this.showLoading(true);
        
        try {
            const imageData = this.canvas.toDataURL('image/png');
            
            const response = await fetch('/api/save-canvas', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    imageData: imageData,
                    format: 'png'
                })
            });

            const result = await response.json();
            
            if (result.success) {
                alert('Imagen guardada exitosamente');
            } else {
                alert('Error al guardar: ' + result.error);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error al guardar la imagen');
        } finally {
            this.showLoading(false);
        }
    }

    downloadImage() {
        const link = document.createElement('a');
        link.download = 'imagen-editada.png';
        link.href = this.canvas.toDataURL();
        link.click();
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.add('show');
        } else {
            overlay.classList.remove('show');
        }
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new PhotoEditor();
});

// Add some utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
            case 'z':
                e.preventDefault();
                if (e.shiftKey) {
                    document.getElementById('redoBtn').click();
                } else {
                    document.getElementById('undoBtn').click();
                }
                break;
            case 's':
                e.preventDefault();
                document.getElementById('saveBtn').click();
                break;
        }
    }
});