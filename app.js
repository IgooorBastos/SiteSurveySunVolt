// ==================== CONFIGURATION ====================
const MAX_PHOTOS = 20;
const MAX_IMAGE_SIZE = 1200;
const IMAGE_QUALITY = 0.8;
const PANEL_WIDTH = 1.15;
const PANEL_HEIGHT = 1.78;
const BORDER_BOTTOM = 0.5;
const BORDER_OTHER = 0.2;
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID_HERE';
const GOOGLE_API_KEY = 'YOUR_GOOGLE_API_KEY_HERE';
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

// ==================== STATE ====================
let currentSection = 1;
const totalSections = 6;
let allPhotos = {
    systemChecks: { wifiSignal: null, earthingRod: null, gasMeter: null, fuseboard: null, electricalMeter: null, waterTank: null },
    roofs: {},
    additional: []
};
let roofCount = 0;
let canvases = {}, contexts = {}, undoStack = {};
let currentColors = {}, colorIndices = {};
let isDrawing = false, activeCanvas = null;
const colors = ['#FF6B00', '#f5576c', '#4caf50', '#ff9800', '#000000'];
const dpr = window.devicePixelRatio || 1;
let gapi_loaded = false;
let is_authorized = false;

// ==================== SUNVOLT LOGO (BASE64) ====================
// Simple SVG logo converted to base64 - replace with actual Sunvolt logo
const SUNVOLT_LOGO = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI0ZGNkIwMCIgcng9IjE1Ii8+CiAgPHRleHQgeD0iNTAiIHk9IjU1IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMzUiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+4piAPC90ZXh0Pgo8L3N2Zz4=';

// ==================== GOOGLE DRIVE INTEGRATION ====================
function initGoogleAPI() {
    gapi.load('client:auth2', () => {
        gapi.client.init({
            apiKey: GOOGLE_API_KEY,
            clientId: GOOGLE_CLIENT_ID,
            discoveryDocs: DISCOVERY_DOCS,
            scope: SCOPES
        }).then(() => {
            gapi_loaded = true;
            updateGDriveStatus();
            gapi.auth2.getAuthInstance().isSignedIn.listen(updateGDriveStatus);
        }).catch(err => {
            console.log('Google API init error:', err);
        });
    });
}

function updateGDriveStatus() {
    if (!gapi_loaded) return;
    is_authorized = gapi.auth2.getAuthInstance().isSignedIn.get();
    const statusDot = document.getElementById('gdriveStatusDot');
    const statusText = document.getElementById('gdriveStatusText');
    const saveBtn = document.getElementById('gdriveSaveBtn');
    const loadBtn = document.getElementById('gdriveLoadBtn');
    const connectBtn = document.getElementById('gdriveConnectBtn');

    if (is_authorized) {
        statusDot.classList.add('connected');
        statusText.textContent = 'Connected to Google Drive';
        saveBtn.style.display = 'block';
        loadBtn.style.display = 'block';
        connectBtn.style.display = 'none';
    } else {
        statusDot.classList.remove('connected');
        statusText.textContent = 'Not connected';
        saveBtn.style.display = 'none';
        loadBtn.style.display = 'none';
        connectBtn.style.display = 'block';
    }
}

window.connectGoogleDrive = function() {
    if (!gapi_loaded) {
        alert('Google API not loaded yet. Please try again.');
        return;
    }
    gapi.auth2.getAuthInstance().signIn();
}

window.saveToGoogleDrive = async function() {
    if (!is_authorized) {
        alert('Please connect to Google Drive first');
        return;
    }

    const loading = document.getElementById('loading');
    loading.classList.add('active');
    document.getElementById('loadingTitle').textContent = 'Saving to Google Drive...';

    try {
        const surveyData = collectSurveyData();
        const content = JSON.stringify(surveyData, null, 2);
        const file = new Blob([content], { type: 'application/json' });
        const metadata = {
            name: `Solar_Survey_${surveyData.metadata.customerName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`,
            mimeType: 'application/json'
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer ' + gapi.auth.getToken().access_token }),
            body: form
        });

        const result = await response.json();
        loading.classList.remove('active');

        if (result.id) {
            alert('✅ Survey saved to Google Drive successfully!');
            closeGDriveModal();
        } else {
            alert('❌ Failed to save to Google Drive');
        }
    } catch (err) {
        loading.classList.remove('active');
        alert('❌ Error: ' + err.message);
    }
}

window.loadFromGoogleDrive = async function() {
    if (!is_authorized) {
        alert('Please connect to Google Drive first');
        return;
    }

    try {
        const response = await gapi.client.drive.files.list({
            pageSize: 10,
            fields: 'files(id, name, modifiedTime)',
            q: "mimeType='application/json' and name contains 'Solar_Survey'"
        });

        const files = response.result.files;
        if (!files || files.length === 0) {
            alert('No survey files found in Google Drive');
            return;
        }

        let fileList = 'Select a file to load:\n\n';
        files.forEach((file, index) => {
            fileList += `${index + 1}. ${file.name}\n`;
        });

        const selection = prompt(fileList + '\nEnter number:');
        if (!selection) return;

        const fileIndex = parseInt(selection) - 1;
        if (fileIndex < 0 || fileIndex >= files.length) {
            alert('Invalid selection');
            return;
        }

        const fileId = files[fileIndex].id;
        const fileResponse = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });

        loadSurveyData(fileResponse.result);
        alert('✅ Survey loaded successfully!');
        closeGDriveModal();
    } catch (err) {
        alert('❌ Error loading from Google Drive: ' + err.message);
    }
}

function openGDriveModal() {
    document.getElementById('gdriveModal').classList.add('active');
    if (!gapi_loaded) {
        initGoogleAPI();
    }
}

window.closeGDriveModal = function() {
    document.getElementById('gdriveModal').classList.remove('active');
}

// ==================== HISTORY MANAGEMENT ====================
function saveToHistory() {
    const surveys = JSON.parse(localStorage.getItem('surveyHistory') || '[]');
    const surveyData = collectSurveyData();
    surveyData.id = Date.now().toString();
    surveys.unshift(surveyData);

    if (surveys.length > 50) surveys.pop();

    localStorage.setItem('surveyHistory', JSON.stringify(surveys));
}

function loadHistory() {
    return JSON.parse(localStorage.getItem('surveyHistory') || '[]');
}

function openHistoryModal() {
    document.getElementById('historyModal').classList.add('active');
    displayHistory();
}

window.closeHistoryModal = function() {
    document.getElementById('historyModal').classList.remove('active');
}

function displayHistory(searchTerm = '') {
    const surveys = loadHistory();
    const historyList = document.getElementById('historyList');

    const filtered = surveys.filter(s => {
        const search = searchTerm.toLowerCase();
        return s.metadata.customerName.toLowerCase().includes(search) ||
            s.metadata.eircode.toLowerCase().includes(search);
    });

    if (filtered.length === 0) {
        historyList.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">No surveys found</p>';
        return;
    }

    historyList.innerHTML = filtered.map(survey => {
        const date = new Date(survey.metadata.dateTime).toLocaleDateString('en-IE');
        const time = new Date(survey.metadata.dateTime).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' });
        const totalPanels = survey.roofs.reduce((sum, roof) => sum + (parseInt(roof.actualPanels) || 0), 0);

        return `
            <div class="history-item" onclick="loadSurveyFromHistory('${survey.id}')">
                <div class="history-header">
                    <div class="history-title">${survey.metadata.customerName}</div>
                    <div class="history-date">${date} ${time}</div>
                </div>
                <div class="history-info">
                    <span>${survey.metadata.eircode}</span>
                    <span>${survey.roofs.length} roof${survey.roofs.length > 1 ? 's' : ''}</span>
                    <span>${totalPanels} panel${totalPanels !== 1 ? 's' : ''}</span>
                </div>
                <div class="history-actions" onclick="event.stopPropagation()">
                    <button class="btn btn-secondary" onclick="loadSurveyFromHistory('${survey.id}')">Load</button>
                    <button class="btn btn-secondary" onclick="deleteSurveyFromHistory('${survey.id}')" style="background: var(--danger);">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

window.loadSurveyFromHistory = function(id) {
    const surveys = loadHistory();
    const survey = surveys.find(s => s.id === id);
    if (!survey) {
        alert('Survey not found');
        return;
    }

    if (!confirm('Load this survey? Current data will be lost.')) return;

    loadSurveyData(survey);
    closeHistoryModal();
    currentSection = 1;
    updateSection();
}

window.deleteSurveyFromHistory = function(id) {
    if (!confirm('Delete this survey from history?')) return;

    let surveys = loadHistory();
    surveys = surveys.filter(s => s.id !== id);
    localStorage.setItem('surveyHistory', JSON.stringify(surveys));
    displayHistory();
}

document.getElementById('historySearch').addEventListener('input', (e) => {
    displayHistory(e.target.value);
});

// ==================== DATA COLLECTION ====================
function collectSurveyData() {
    const data = {
        metadata: {
            eircode: document.getElementById('eircode').value,
            customerName: document.getElementById('customerName').value,
            dateTime: document.getElementById('dateTime').value,
            exportDate: new Date().toISOString()
        },
        systemChecks: {},
        roofs: [],
        preferences: {
            inverterType: document.querySelector('input[name="inverterType"]:checked')?.value,
            batteryKwh: document.getElementById('batteryKwh').value,
            epsSwitch: document.getElementById('epsSwitch').checked,
            eddi: document.getElementById('eddi').checked,
            birdProtector: document.getElementById('birdProtector').checked
        },
        notes: {
            system: document.getElementById('systemNotes').value,
            preferences: document.getElementById('preferencesNotes').value,
            general: document.getElementById('generalNotes').value
        },
        photos: allPhotos
    };

    ['wifiSignal', 'earthingRod', 'gasMeter', 'fuseboard', 'electricalMeter', 'waterTank'].forEach(check => {
        const radio = document.querySelector(`input[name="${check}"]:checked`);
        data.systemChecks[check] = radio ? radio.value : null;
    });

    document.querySelectorAll('.roof-card').forEach(card => {
        const num = card.getAttribute('data-roof');
        const condition = document.querySelector(`input[name="roofCondition${num}"]:checked`);
        data.roofs.push({
            number: num,
            condition: condition?.value,
            length: document.getElementById('roofLength' + num).value,
            width: document.getElementById('roofWidth' + num).value,
            actualPanels: document.getElementById('roofPanels' + num).value,
            optimisers: document.getElementById('roofOptimisers' + num).value,
            orientation: document.getElementById('roofOrientation' + num).value,
            pitch: document.getElementById('roofPitch' + num).value,
            notes: document.getElementById('roofNotes' + num).value
        });
    });

    return data;
}

function loadSurveyData(data) {
    // Load basic metadata
    document.getElementById('eircode').value = data.metadata.eircode || '';
    document.getElementById('customerName').value = data.metadata.customerName || '';
    document.getElementById('dateTime').value = data.metadata.dateTime || '';
    document.getElementById('systemNotes').value = data.notes?.system || '';
    document.getElementById('preferencesNotes').value = data.notes?.preferences || '';
    document.getElementById('generalNotes').value = data.notes?.general || '';
    document.getElementById('batteryKwh').value = data.preferences?.batteryKwh || '';
    document.getElementById('epsSwitch').checked = data.preferences?.epsSwitch || false;
    document.getElementById('eddi').checked = data.preferences?.eddi || false;
    document.getElementById('birdProtector').checked = data.preferences?.birdProtector || false;

    // Load system checks
    if (data.systemChecks) {
        Object.keys(data.systemChecks).forEach(check => {
            if (data.systemChecks[check]) {
                const radio = document.querySelector(`input[name="${check}"][value="${data.systemChecks[check]}"]`);
                if (radio) {
                    radio.checked = true;
                    radio.closest('.radio-btn').classList.add('selected');
                }
            }
        });
    }

    // Load inverter type
    if (data.preferences?.inverterType) {
        const radio = document.querySelector(`input[name="inverterType"][value="${data.preferences.inverterType}"]`);
        if (radio) {
            radio.checked = true;
            radio.closest('.radio-btn').classList.add('selected');
        }
    }

    // Clear existing roofs
    document.getElementById('roofsContainer').innerHTML = '';
    roofCount = 0;
    allPhotos.roofs = {};
    canvases = {};
    contexts = {};
    currentColors = {};
    colorIndices = {};
    undoStack = {};

    // Recreate roofs from data
    if (data.roofs && data.roofs.length > 0) {
        data.roofs.forEach(roofData => {
            addRoof();

            const num = roofCount;

            // Load roof condition
            if (roofData.condition) {
                const radio = document.querySelector(`input[name="roofCondition${num}"][value="${roofData.condition}"]`);
                if (radio) {
                    radio.checked = true;
                    radio.closest('.radio-btn').classList.add('selected');
                }
            }

            // Load roof dimensions
            if (roofData.length) document.getElementById('roofLength' + num).value = roofData.length;
            if (roofData.width) document.getElementById('roofWidth' + num).value = roofData.width;
            if (roofData.actualPanels) document.getElementById('roofPanels' + num).value = roofData.actualPanels;
            if (roofData.optimisers) document.getElementById('roofOptimisers' + num).value = roofData.optimisers;
            if (roofData.orientation) document.getElementById('roofOrientation' + num).value = roofData.orientation;
            if (roofData.pitch) document.getElementById('roofPitch' + num).value = roofData.pitch;
            if (roofData.notes) document.getElementById('roofNotes' + num).value = roofData.notes;

            // Trigger calculation
            const lengthInput = document.getElementById('roofLength' + num);
            const widthInput = document.getElementById('roofWidth' + num);
            if (lengthInput && widthInput) {
                lengthInput.dispatchEvent(new Event('input'));
            }
        });
    } else {
        // Add at least one roof if none exist
        addRoof();
    }

    // Load photos
    if (data.photos) {
        allPhotos = data.photos;

        // Restore system check photo previews
        Object.keys(allPhotos.systemChecks).forEach(checkType => {
            if (allPhotos.systemChecks[checkType]) {
                const preview = document.getElementById(checkType + 'Preview');
                if (preview) {
                    preview.innerHTML = '';
                    const photoItem = document.createElement('div');
                    photoItem.className = 'photo-item';
                    const img = document.createElement('img');
                    img.src = allPhotos.systemChecks[checkType];
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'photo-delete';
                    deleteBtn.innerHTML = '×';
                    deleteBtn.addEventListener('click', () => {
                        allPhotos.systemChecks[checkType] = null;
                        preview.innerHTML = '';
                        updatePhotoCount();
                    });
                    photoItem.appendChild(img);
                    photoItem.appendChild(deleteBtn);
                    preview.appendChild(photoItem);
                }
            }
        });

        // Restore roof photo previews
        Object.keys(allPhotos.roofs).forEach(roofNum => {
            const photos = allPhotos.roofs[roofNum];
            if (photos && photos.length > 0) {
                const preview = document.getElementById('roofPhotoPreview' + roofNum);
                if (preview) {
                    preview.innerHTML = '';
                    photos.forEach(photoData => {
                        const photoItem = document.createElement('div');
                        photoItem.className = 'photo-item';
                        const img = document.createElement('img');
                        img.src = photoData;
                        const deleteBtn = document.createElement('button');
                        deleteBtn.className = 'photo-delete';
                        deleteBtn.innerHTML = '×';
                        deleteBtn.addEventListener('click', () => {
                            const index = allPhotos.roofs[roofNum].indexOf(photoData);
                            if (index > -1) allPhotos.roofs[roofNum].splice(index, 1);
                            photoItem.remove();
                            updatePhotoCount();
                        });
                        photoItem.appendChild(img);
                        photoItem.appendChild(deleteBtn);
                        preview.appendChild(photoItem);
                    });
                }
            }
        });

        // Restore additional photos
        if (allPhotos.additional && allPhotos.additional.length > 0) {
            const preview = document.getElementById('additionalPhotoPreview');
            if (preview) {
                preview.innerHTML = '';
                allPhotos.additional.forEach(photoData => {
                    const photoItem = document.createElement('div');
                    photoItem.className = 'photo-item';
                    const img = document.createElement('img');
                    img.src = photoData;
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'photo-delete';
                    deleteBtn.innerHTML = '×';
                    deleteBtn.addEventListener('click', () => {
                        const index = allPhotos.additional.indexOf(photoData);
                        if (index > -1) allPhotos.additional.splice(index, 1);
                        photoItem.remove();
                        updatePhotoCount();
                    });
                    photoItem.appendChild(img);
                    photoItem.appendChild(deleteBtn);
                    preview.appendChild(photoItem);
                });
            }
        }

        updatePhotoCount();
    }

    // Update checkbox visual states
    document.querySelectorAll('.checkbox-item').forEach(item => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox && checkbox.checked) {
            item.classList.add('checked');
        }
    });

    console.log('✅ Survey data loaded successfully');
}

// ==================== DARK MODE ====================
const themeToggle = document.getElementById('themeToggle');
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
themeToggle.querySelector('span').textContent = savedTheme === 'dark' ? '☀️' : '🌙';

themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    themeToggle.querySelector('span').textContent = newTheme === 'dark' ? '☀️' : '🌙';
});

// ==================== AUTO-SAVE ====================
function autoSave() {
    const data = collectSurveyData();
    localStorage.setItem('solarSurveyDraft', JSON.stringify(data));
    showAutoSaveIndicator();
}

function showAutoSaveIndicator() {
    const indicator = document.getElementById('autoSaveIndicator');
    indicator.classList.add('show');
    setTimeout(() => indicator.classList.remove('show'), 2000);
}

function loadDraft() {
    const draft = localStorage.getItem('solarSurveyDraft');
    if (draft) {
        try {
            const data = JSON.parse(draft);
            if (confirm('Recover previous survey draft?')) {
                loadSurveyData(data);
            }
        } catch (e) {
            console.error('Failed to load draft:', e);
        }
    }
}

setInterval(autoSave, 30000);
document.querySelectorAll('input, textarea, select').forEach(el => {
    el.addEventListener('change', autoSave);
});

// ==================== IMAGE COMPRESSION ====================
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_IMAGE_SIZE) {
                        height = Math.round(height * MAX_IMAGE_SIZE / width);
                        width = MAX_IMAGE_SIZE;
                    }
                } else {
                    if (height > MAX_IMAGE_SIZE) {
                        width = Math.round(width * MAX_IMAGE_SIZE / height);
                        height = MAX_IMAGE_SIZE;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                resolve(canvas.toDataURL('image/jpeg', IMAGE_QUALITY));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ==================== PHOTO MANAGEMENT ====================
function getTotalPhotoCount() {
    let count = 0;
    count += Object.values(allPhotos.systemChecks).filter(p => p).length;
    count += Object.values(allPhotos.roofs).reduce((sum, photos) => sum + photos.length, 0);
    count += allPhotos.additional.length;
    return count;
}

function updatePhotoCount() {
    const total = getTotalPhotoCount();
    const countEl = document.getElementById('photoCount');
    if (countEl) countEl.textContent = total;
}

function canAddPhoto() {
    return getTotalPhotoCount() < MAX_PHOTOS;
}

// ==================== PANEL CALCULATION (OPTIMIZED) ====================
function calculatePanels(length, width) {
    const usableLength = length - BORDER_OTHER - BORDER_BOTTOM;
    const usableWidth = width - (BORDER_OTHER * 2);

    if (usableLength <= 0 || usableWidth <= 0) {
        return {
            count: 0,
            layout: 'Insufficient space',
            details: 'Roof dimensions too small for solar panels'
        };
    }

    const minSizePortrait = Math.min(PANEL_WIDTH, PANEL_HEIGHT);

    if (usableLength < minSizePortrait || usableWidth < minSizePortrait) {
        return {
            count: 0,
            layout: 'No panels fit',
            details: 'Available space too small after applying safety margins'
        };
    }

    let bestSolution = { count: 0, description: '', panels: [] };

    // Portrait
    const portraitRows = Math.floor(usableLength / PANEL_HEIGHT);
    const portraitCols = Math.floor(usableWidth / PANEL_WIDTH);
    const portraitCount = portraitRows * portraitCols;

    if (portraitCount > bestSolution.count) {
        bestSolution = {
            count: portraitCount,
            type: 'Portrait',
            description: `${portraitRows} rows × ${portraitCols} columns`,
            panels: []
        };
    }

    // Landscape
    const landscapeRows = Math.floor(usableLength / PANEL_WIDTH);
    const landscapeCols = Math.floor(usableWidth / PANEL_HEIGHT);
    const landscapeCount = landscapeRows * landscapeCols;

    if (landscapeCount > bestSolution.count) {
        bestSolution = {
            count: landscapeCount,
            type: 'Landscape',
            description: `${landscapeRows} rows × ${landscapeCols} columns`,
            panels: []
        };
    }

    // Mixed strategies
    for (let pRows = 0; pRows <= Math.floor(usableLength / PANEL_HEIGHT); pRows++) {
        const usedLength = pRows * PANEL_HEIGHT;
        const remainingLength = usableLength - usedLength;

        const pCols = Math.floor(usableWidth / PANEL_WIDTH);
        const portraitInThisRow = pRows * pCols;

        const lRows = Math.floor(remainingLength / PANEL_WIDTH);
        const lCols = Math.floor(usableWidth / PANEL_HEIGHT);
        const landscapeBelow = lRows * lCols;

        const total = portraitInThisRow + landscapeBelow;

        if (total > bestSolution.count) {
            bestSolution = {
                count: total,
                type: 'Mixed',
                description: `${pRows}×${pCols} Portrait + ${lRows}×${lCols} Landscape`,
                panels: []
            };
        }
    }

    if (bestSolution.count === 0) {
        return {
            count: 0,
            layout: 'No panels fit',
            details: 'Available space too small after applying safety margins'
        };
    }

    const totalPanelArea = bestSolution.count * (PANEL_WIDTH * PANEL_HEIGHT);
    const roofArea = length * width;
    const coveragePercent = ((totalPanelArea / roofArea) * 100).toFixed(1);

    return {
        count: bestSolution.count,
        layout: `${bestSolution.type} (${bestSolution.description})`,
        details: `Panel: ${PANEL_WIDTH}m × ${PANEL_HEIGHT}m | Coverage: ${coveragePercent}% | Margins: Bottom ${BORDER_BOTTOM}m, Sides ${BORDER_OTHER}m`,
        coveragePercent: parseFloat(coveragePercent),
        type: bestSolution.type
    };
}

// ==================== CANVAS ====================
function getMousePos(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let clientX = e.touches ? e.touches[0].clientX : e.clientX;
    let clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

function saveCanvasState(num) {
    const canvas = canvases[num];
    if (!canvas) return;

    if (!undoStack[num]) undoStack[num] = [];
    undoStack[num].push(canvas.toDataURL());

    if (undoStack[num].length > 10) {
        undoStack[num].shift();
    }
}

function undoCanvas(num) {
    if (!undoStack[num] || undoStack[num].length === 0) {
        alert('Nothing to undo');
        return;
    }

    const canvas = canvases[num];
    const ctx = contexts[num];
    const lastState = undoStack[num].pop();

    const img = new Image();
    img.onload = () => {
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        ctx.drawImage(img, 0, 0, canvas.width / dpr, canvas.height / dpr);
    };
    img.src = lastState;
}

function setupCanvas(canvas, num) {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    contexts[num] = ctx;
    undoStack[num] = [];

    let drawing = false;

    function start(e) {
        saveCanvasState(num);
        drawing = true;
        isDrawing = true;
        activeCanvas = num;
        const pos = getMousePos(canvas, e);
        ctx.beginPath();
        ctx.moveTo(pos.x / dpr, pos.y / dpr);
    }

    function draw(e) {
        if (!drawing || activeCanvas !== num) return;
        e.preventDefault();
        const pos = getMousePos(canvas, e);
        ctx.lineTo(pos.x / dpr, pos.y / dpr);
        ctx.strokeStyle = currentColors[num];
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    function stop() {
        drawing = false;
        isDrawing = false;
        activeCanvas = null;
    }

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stop);
    canvas.addEventListener('mouseout', stop);
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); start(e); }, { passive: false });
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); }, { passive: false });
    canvas.addEventListener('touchend', (e) => { e.preventDefault(); stop(); }, { passive: false });
}

// ==================== ROOF MANAGEMENT ====================
function createRoofHTML(num) {
    return `
        <div class="roof-card" data-roof="${num}">
            <div class="roof-card-header">
                <div class="roof-card-title">Roof #${num}</div>
                <button type="button" class="btn btn-secondary" style="width: auto; padding: 10px 16px; font-size: 14px; ${num === 1 ? 'display: none;' : ''}" onclick="removeRoof(${num})">🗑️</button>
            </div>

            <div class="form-group">
                <label>Condition</label>
                <div class="radio-group">
                    <label class="radio-btn"><input type="radio" name="roofCondition${num}" value="Good">✅ Good</label>
                    <label class="radio-btn"><input type="radio" name="roofCondition${num}" value="Poor">❌ Poor</label>
                    <button type="button" class="radio-btn radio-clear" data-group="roofCondition${num}">✖</button>
                </div>
            </div>

            <div class="form-group">
                <label>Dimensions (meters)</label>
                <div class="dimension-grid">
                    <input type="number" id="roofLength${num}" placeholder="Length" step="0.01" min="0">
                    <input type="number" id="roofWidth${num}" placeholder="Width" step="0.01" min="0">
                    <input type="text" id="roofArea${num}" readonly placeholder="Area (m²)" style="background: #e8f5e9; color: #2e7d32; font-weight: 600;">
                </div>
            </div>

            <div class="form-group">
                <label>Panel Estimation (Guide Only)</label>
                <input type="text" id="roofSuggestedPanels${num}" readonly placeholder="Enter dimensions to see estimate" style="background: #fff4e6; color: #7a4510; font-weight: 600; border: 2px dashed var(--warning);">
                <div class="info-badge" id="roofPanelInfo${num}" style="display: none; background: #e6f7ff; border-color: var(--primary); color: #003d99;">
                    <strong>This is an automatic estimate only.</strong><br>
                    Actual installation may vary based on roof features, obstructions, and technical requirements.
                </div>
            </div>

            <div class="form-group">
                <label>Actual Installation</label>
                <div class="panel-grid">
                    <input type="number" id="roofPanels${num}" placeholder="Panels" min="0" step="1">
                    <input type="number" id="roofOptimisers${num}" placeholder="Optimisers" min="0" step="1">
                </div>
            </div>

            <div class="orientation-grid">
                <div class="form-group">
                    <label>Direction</label>
                    <select id="roofOrientation${num}">
                        <option value="">Select...</option>
                        <option value="N">North</option>
                        <option value="NE">Northeast</option>
                        <option value="E">East</option>
                        <option value="SE">Southeast</option>
                        <option value="S">South</option>
                        <option value="SW">Southwest</option>
                        <option value="W">West</option>
                        <option value="NW">Northwest</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Pitch (°)</label>
                    <input type="number" id="roofPitch${num}" value="30" min="0" max="90">
                </div>
            </div>

            <button type="button" class="btn roof-photo-btn" data-roof="${num}">📷 Add Photos</button>
            <input type="file" id="roofPhotoInput${num}" accept="image/*" capture="environment" style="display: none;" multiple>
            <div id="roofPhotoPreview${num}" class="photo-preview"></div>

            <div class="form-group">
                <label>Notes</label>
                <textarea id="roofNotes${num}" placeholder="Observations"></textarea>
            </div>

            <div class="form-group">
                <label>Roof Sketch</label>
                <div class="canvas-container">
                    <canvas id="roofSketch${num}" width="800" height="600"></canvas>
                </div>
                <div class="canvas-controls">
                    <button type="button" class="btn btn-secondary undo-sketch" data-roof="${num}">↶ Undo</button>
                    <button type="button" class="btn btn-secondary clear-sketch" data-roof="${num}">🗑️ Clear</button>
                    <button type="button" class="btn btn-secondary change-color" data-roof="${num}">🎨 Color</button>
                </div>
            </div>
        </div>
    `;
}

function addRoof() {
    roofCount++;
    allPhotos.roofs[roofCount] = [];
    document.getElementById('roofsContainer').insertAdjacentHTML('beforeend', createRoofHTML(roofCount));

    const canvas = document.getElementById('roofSketch' + roofCount);
    canvases[roofCount] = canvas;
    currentColors[roofCount] = '#FF6B00';
    colorIndices[roofCount] = 0;

    setTimeout(() => {
        if (canvas && canvas.offsetParent !== null) {
            setupCanvas(canvas, roofCount);
        }
    }, 150);

    const lengthInput = document.getElementById('roofLength' + roofCount);
    const widthInput = document.getElementById('roofWidth' + roofCount);
    const areaInput = document.getElementById('roofArea' + roofCount);
    const suggestedInput = document.getElementById('roofSuggestedPanels' + roofCount);
    const panelInfo = document.getElementById('roofPanelInfo' + roofCount);

    function calc() {
        const l = parseFloat(lengthInput.value) || 0;
        const w = parseFloat(widthInput.value) || 0;
        const area = l * w;
        areaInput.value = area > 0 ? area.toFixed(2) + ' m²' : '';

        if (l > 0 && w > 0) {
            const result = calculatePanels(l, w);
            if (result.count > 0) {
                let coverageIcon = '💡';
                let coverageColor = '';

                if (result.coveragePercent >= 70) {
                    coverageIcon = '🟢';
                    coverageColor = 'color: #28a745;';
                } else if (result.coveragePercent >= 50) {
                    coverageIcon = '🟡';
                    coverageColor = 'color: #ffc107;';
                } else {
                    coverageIcon = '🟠';
                    coverageColor = 'color: #fd7e14;';
                }

                suggestedInput.value = `~${result.count} panels - ${result.layout}`;
                panelInfo.innerHTML = `
                    <strong>Automatic Estimate - For Reference Only</strong><br>
                    <div style="margin-top: 8px; ${coverageColor}">
                        <strong>${coverageIcon} Roof Coverage: ${result.coveragePercent}%</strong>
                    </div>
                    <div style="margin-top: 6px; font-size: 12px;">
                        ${result.details}
                    </div>
                    <div style="margin-top: 8px; font-style: italic; color: #666;">
                        Final panel count may vary due to roof obstructions, chimneys, vents, skylights, and structural limitations. Professional site assessment required.
                    </div>
                `;
                panelInfo.style.display = 'block';
            } else {
                suggestedInput.value = result.layout;
                panelInfo.innerHTML = `<strong>${result.details}</strong>`;
                panelInfo.style.display = 'block';
            }
        } else {
            suggestedInput.value = '';
            panelInfo.style.display = 'none';
        }
    }

    lengthInput.addEventListener('input', calc);
    widthInput.addEventListener('input', calc);

    const panelsInput = document.getElementById('roofPanels' + roofCount);
    const optimisersInput = document.getElementById('roofOptimisers' + roofCount);

    optimisersInput.addEventListener('blur', function() {
        const panels = parseInt(panelsInput.value) || 0;
        const optimisers = parseInt(this.value) || 0;

        if (optimisers > panels && panels > 0) {
            this.value = panels;
            alert('Optimisers cannot exceed panel count');
        }
    });

    const photoBtn = document.querySelector(`.roof-photo-btn[data-roof="${roofCount}"]`);
    const photoInput = document.getElementById('roofPhotoInput' + roofCount);
    const photoPreview = document.getElementById('roofPhotoPreview' + roofCount);

    photoBtn.addEventListener('click', () => {
        if (!canAddPhoto()) {
            alert(`Maximum ${MAX_PHOTOS} photos reached`);
            return;
        }
        photoInput.click();
    });

    photoInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        for (const file of files) {
            if (!canAddPhoto()) {
                alert(`Maximum ${MAX_PHOTOS} photos reached`);
                break;
            }

            try {
                const compressedData = await compressImage(file);
                allPhotos.roofs[roofCount].push(compressedData);

                const photoItem = document.createElement('div');
                photoItem.className = 'photo-item';
                const img = document.createElement('img');
                img.src = compressedData;
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'photo-delete';
                deleteBtn.innerHTML = '×';
                deleteBtn.addEventListener('click', () => {
                    const index = allPhotos.roofs[roofCount].indexOf(compressedData);
                    if (index > -1) allPhotos.roofs[roofCount].splice(index, 1);
                    photoItem.remove();
                    updatePhotoCount();
                });
                photoItem.appendChild(img);
                photoItem.appendChild(deleteBtn);
                photoPreview.appendChild(photoItem);
                updatePhotoCount();
            } catch (err) {
                alert('Failed to process image');
            }
        }
        photoInput.value = '';
    });

    initRadios();
    if (roofCount > 1) {
        const firstRemove = document.querySelector('.roof-card[data-roof="1"] button');
        if (firstRemove) firstRemove.style.display = 'inline-block';
    }
}

window.removeRoof = function(num) {
    if (confirm(`Remove Roof #${num}?`)) {
        document.querySelector(`.roof-card[data-roof="${num}"]`).remove();
        delete allPhotos.roofs[num];
        delete canvases[num];
        delete contexts[num];
        delete currentColors[num];
        delete colorIndices[num];
        delete undoStack[num];
        updatePhotoCount();
        if (document.querySelectorAll('.roof-card').length === 1) {
            const firstRemove = document.querySelector('.roof-card[data-roof="1"] button');
            if (firstRemove) firstRemove.style.display = 'none';
        }
    }
};

// ==================== RADIO BUTTONS ====================
function initRadios() {
    document.querySelectorAll('.radio-btn').forEach(btn => {
        const radio = btn.querySelector('input[type="radio"]');
        if (!radio || btn.dataset.initialized) return;
        btn.dataset.initialized = 'true';

        btn.addEventListener('click', () => {
            document.querySelectorAll(`input[name="${radio.name}"]`).forEach(r => {
                r.closest('.radio-btn').classList.remove('selected');
            });
            btn.classList.add('selected');
            radio.checked = true;
        });
    });
}

// ==================== SYSTEM CHECK PHOTOS ====================
document.querySelectorAll('.btn-photo').forEach(btn => {
    const type = btn.getAttribute('data-photo');
    const input = document.getElementById(type + 'Photo');
    const preview = document.getElementById(type + 'Preview');

    btn.addEventListener('click', () => {
        if (!canAddPhoto()) {
            alert(`Maximum ${MAX_PHOTOS} photos reached`);
            return;
        }
        input.click();
    });

    input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const compressedData = await compressImage(file);
                allPhotos.systemChecks[type] = compressedData;
                preview.innerHTML = '';
                const photoItem = document.createElement('div');
                photoItem.className = 'photo-item';
                const img = document.createElement('img');
                img.src = compressedData;
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'photo-delete';
                deleteBtn.innerHTML = '×';
                deleteBtn.addEventListener('click', () => {
                    allPhotos.systemChecks[type] = null;
                    preview.innerHTML = '';
                    input.value = '';
                    updatePhotoCount();
                });
                photoItem.appendChild(img);
                photoItem.appendChild(deleteBtn);
                preview.appendChild(photoItem);
                updatePhotoCount();
            } catch (err) {
                alert('Failed to process image');
            }
        }
        input.value = '';
    });
});

// ==================== CANVAS CONTROLS ====================
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('radio-clear')) {
        const groupName = e.target.getAttribute('data-group');
        document.querySelectorAll(`input[name="${groupName}"]`).forEach(radio => {
            radio.checked = false;
            radio.closest('.radio-btn').classList.remove('selected');
        });
    }

    if (e.target.classList.contains('undo-sketch')) {
        const num = parseInt(e.target.getAttribute('data-roof'));
        undoCanvas(num);
    }

    if (e.target.classList.contains('clear-sketch')) {
        const num = parseInt(e.target.getAttribute('data-roof'));
        const ctx = contexts[num];
        const canvas = canvases[num];
        if (ctx && canvas) {
            saveCanvasState(num);
            ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        }
    }

    if (e.target.classList.contains('change-color')) {
        const num = parseInt(e.target.getAttribute('data-roof'));
        colorIndices[num] = (colorIndices[num] + 1) % colors.length;
        currentColors[num] = colors[colorIndices[num]];
        const names = ['Orange', 'Red', 'Green', 'Amber', 'Black'];
        e.target.textContent = '🎨 ' + names[colorIndices[num]];
        setTimeout(() => { e.target.textContent = '🎨 Color'; }, 2000);
    }
});

// ==================== ADDITIONAL PHOTOS ====================
document.getElementById('additionalPhoto').addEventListener('click', () => {
    if (!canAddPhoto()) {
        alert(`Maximum ${MAX_PHOTOS} photos reached`);
        return;
    }
    document.getElementById('additionalPhotoInput').click();
});

document.getElementById('additionalPhotoInput').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
        if (!canAddPhoto()) {
            alert(`Maximum ${MAX_PHOTOS} photos reached`);
            break;
        }

        try {
            const compressedData = await compressImage(file);
            allPhotos.additional.push(compressedData);

            const photoItem = document.createElement('div');
            photoItem.className = 'photo-item';
            const img = document.createElement('img');
            img.src = compressedData;
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'photo-delete';
            deleteBtn.innerHTML = '×';
            deleteBtn.addEventListener('click', () => {
                const index = allPhotos.additional.indexOf(compressedData);
                if (index > -1) allPhotos.additional.splice(index, 1);
                photoItem.remove();
                updatePhotoCount();
            });
            photoItem.appendChild(img);
            photoItem.appendChild(deleteBtn);
            document.getElementById('additionalPhotoPreview').appendChild(photoItem);
            updatePhotoCount();
        } catch (err) {
            alert('Failed to process image');
        }
    }
    e.target.value = '';
});

// ==================== CHECKBOXES ====================
document.querySelectorAll('.checkbox-item').forEach(item => {
    const checkbox = item.querySelector('input[type="checkbox"]');
    if (checkbox) {
        item.addEventListener('click', (e) => {
            if (e.target !== checkbox) {
                checkbox.checked = !checkbox.checked;
            }
            item.classList.toggle('checked', checkbox.checked);
        });
    }
});

document.getElementById('addRoofBtn').addEventListener('click', addRoof);

// ==================== NAVIGATION ====================
function updateSection() {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelector(`[data-section="${currentSection}"]`).classList.add('active');
    document.getElementById('prevBtn').disabled = currentSection === 1;
    document.getElementById('nextBtn').textContent = currentSection === totalSections ? 'Review ✅' : 'Next →';
    const progress = ((currentSection - 1) / (totalSections - 1)) * 100;
    document.getElementById('progressFill').style.width = progress + '%';
    document.getElementById('progressText').textContent = `${Math.round(progress)}% - Section ${currentSection}/${totalSections}`;

    if (currentSection === totalSections) generateReviewSummary();

    if (currentSection === 3) {
        setTimeout(() => {
            Object.keys(canvases).forEach(roofNum => {
                const canvas = document.getElementById('roofSketch' + roofNum);
                if (canvas && canvas.offsetParent !== null && !contexts[roofNum]) {
                    setupCanvas(canvas, parseInt(roofNum));
                }
            });
        }, 200);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('nextBtn').addEventListener('click', () => {
    if (currentSection < totalSections) {
        currentSection++;
        updateSection();
    }
});

document.getElementById('prevBtn').addEventListener('click', () => {
    if (currentSection > 1) {
        currentSection--;
        updateSection();
    }
});

// ==================== REVIEW SUMMARY ====================
function generateReviewSummary() {
    const reviewContainer = document.getElementById('surveyReview');

    const systemChecks = ['wifiSignal', 'earthingRod', 'gasMeter', 'fuseboard', 'electricalMeter', 'waterTank'];
    const systemLabels = {
        wifiSignal: 'WiFi Signal',
        earthingRod: 'Earthing Rod',
        gasMeter: 'Gas Meter',
        fuseboard: 'Fuseboard',
        electricalMeter: 'Electrical Meter',
        waterTank: 'Water Tank'
    };

    let positiveChecks = [];
    let negativeChecks = [];

    systemChecks.forEach(check => {
        const radio = document.querySelector(`input[name="${check}"]:checked`);
        if (radio) {
            if (radio.value === 'Yes') positiveChecks.push(systemLabels[check]);
            else if (radio.value === 'No') negativeChecks.push(systemLabels[check]);
        }
    });

    const roofCards = document.querySelectorAll('.roof-card');
    let totalRoofs = roofCards.length;
    let totalActualPanels = 0;
    let totalOptimisers = 0;

    roofCards.forEach(card => {
        const num = card.getAttribute('data-roof');
        totalActualPanels += parseInt(document.getElementById('roofPanels' + num).value) || 0;
        totalOptimisers += parseInt(document.getElementById('roofOptimisers' + num).value) || 0;
    });

    const batteryKwh = document.getElementById('batteryKwh').value;
    const inverterType = document.querySelector('input[name="inverterType"]:checked');
    const epsSwitch = document.getElementById('epsSwitch').checked;
    const eddi = document.getElementById('eddi').checked;
    const birdProtector = document.getElementById('birdProtector').checked;

    let systemPhotoCount = Object.values(allPhotos.systemChecks).filter(p => p).length;
    let totalRoofPhotos = Object.values(allPhotos.roofs).reduce((sum, photos) => sum + photos.length, 0);
    let totalPhotos = systemPhotoCount + totalRoofPhotos + allPhotos.additional.length;

    let html = `
        <div style="background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%); color: white; border-radius: 14px; padding: 24px; margin-bottom: 20px;">
            <div style="font-size: 1.4em; font-weight: 700; margin-bottom: 18px; text-align: center;">Survey Summary</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                <div style="background: rgba(255,255,255,0.15); border-radius: 10px; padding: 14px; text-align: center;">
                    <span style="font-size: 2.2em; font-weight: 700; display: block;">${positiveChecks.length}/${systemChecks.length}</span>
                    <div style="font-size: 0.85em; opacity: 0.9; margin-top: 6px;">Checks Passed</div>
                </div>
                <div style="background: rgba(255,255,255,0.15); border-radius: 10px; padding: 14px; text-align: center;">
                    <span style="font-size: 2.2em; font-weight: 700; display: block;">${totalRoofs}</span>
                    <div style="font-size: 0.85em; opacity: 0.9; margin-top: 6px;">Roofs</div>
                </div>
                <div style="background: rgba(255,255,255,0.15); border-radius: 10px; padding: 14px; text-align: center;">
                    <span style="font-size: 2.2em; font-weight: 700; display: block;">${totalPhotos}</span>
                    <div style="font-size: 0.85em; opacity: 0.9; margin-top: 6px;">Photos</div>
                </div>
                <div style="background: rgba(255,255,255,0.15); border-radius: 10px; padding: 14px; text-align: center;">
                    <span style="font-size: 2.2em; font-weight: 700; display: block;">${totalActualPanels}</span>
                    <div style="font-size: 0.85em; opacity: 0.9; margin-top: 6px;">Panels</div>
                </div>
            </div>
        </div>

        ${positiveChecks.length > 0 ? `<div style="background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 18px; margin-bottom: 18px;">
            <div style="font-size: 1.2em; font-weight: 700; color: var(--success); margin-bottom: 14px;">Passed (${positiveChecks.length})</div>
            <ul style="list-style: none; padding: 0;">
                ${positiveChecks.map(item => `<li style="padding: 8px 0; border-bottom: 1px solid #f0f0f0; color: #28a745; font-weight: 600;">✓ ${item}</li>`).join('')}
            </ul>
        </div>` : ''}

        ${negativeChecks.length > 0 ? `<div style="background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 18px; margin-bottom: 18px;">
            <div style="font-size: 1.2em; font-weight: 700; color: var(--danger); margin-bottom: 14px;">Failed (${negativeChecks.length})</div>
            <ul style="list-style: none; padding: 0;">
                ${negativeChecks.map(item => `<li style="padding: 8px 0; border-bottom: 1px solid #f0f0f0; color: #dc3545; font-weight: 600;">✗ ${item}</li>`).join('')}
            </ul>
        </div>` : ''}

        <div style="background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 18px; margin-bottom: 18px;">
            <div style="font-size: 1.2em; font-weight: 700; color: var(--primary); margin-bottom: 14px;">System Configuration</div>
            <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0f0f0;">
                <span style="color: #666;">Solar Panels</span>
                <span style="font-weight: 700;">${totalActualPanels || 'N/A'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0f0f0;">
                <span style="color: #666;">Optimisers</span>
                <span style="font-weight: 700;">${totalOptimisers || 'N/A'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0f0f0;">
                <span style="color: #666;">Battery Storage</span>
                <span style="font-weight: 700;">${batteryKwh ? batteryKwh + ' kWh' : 'N/A'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 10px 0;">
                <span style="color: #666;">Inverter Type</span>
                <span style="font-weight: 700;">${inverterType?.value || 'N/A'}</span>
            </div>
        </div>

        ${(totalActualPanels === 0 || !batteryKwh) ? `
        <div style="background: #fff3cd; border: 2px solid #ffc107; color: #856404; border-radius: 10px; padding: 14px; margin-bottom: 14px;">
            <strong>Incomplete</strong>
            ${totalActualPanels === 0 ? '<div>• No panels specified</div>' : ''}
            ${!batteryKwh ? '<div>• Battery not specified</div>' : ''}
        </div>` : `
        <div style="background: #d4edda; border: 2px solid #28a745; color: #155724; border-radius: 10px; padding: 14px; margin-bottom: 14px;">
            <strong>Complete</strong> - Ready to export professional report
        </div>`}
    `;

    reviewContainer.innerHTML = html;
}

// ==================== PDF GENERATION (IMPROVED - NO DISTORTION) ====================
document.getElementById('generatePDF').addEventListener('click', async () => {
    const loading = document.getElementById('loading');
    const loadingTitle = document.getElementById('loadingTitle');
    const loadingProgress = document.getElementById('loadingProgress');

    loading.classList.add('active');
    loadingTitle.textContent = 'Generating Professional PDF Report...';
    loadingProgress.textContent = 'Preparing document structure...';

    saveToHistory();

    setTimeout(async () => {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            let yPos = 20;
            const lineHeight = 6;
            const pageHeight = doc.internal.pageSize.height;
            const pageWidth = doc.internal.pageSize.width;
            const margin = 20;
            const maxWidth = pageWidth - (margin * 2);
            let pageNum = 1;

            loadingProgress.textContent = 'Building report structure...';

            function addPageNumber() {
                doc.setFontSize(9);
                doc.setTextColor(150, 150, 150);
                doc.text(`Page ${pageNum}`, pageWidth - 30, pageHeight - 10);
                doc.setTextColor(0, 0, 0);
                pageNum++;
            }

            function checkPage(space = 30) {
                if (yPos > pageHeight - space) {
                    addPageNumber();
                    doc.addPage();
                    yPos = 20;
                }
            }

            function addText(text, isBold = false, fontSize = 10, color = [0, 0, 0]) {
                checkPage();
                doc.setFontSize(fontSize);
                doc.setFont(undefined, isBold ? 'bold' : 'normal');
                doc.setTextColor(...color);
                const lines = doc.splitTextToSize(text, maxWidth);
                lines.forEach(line => {
                    checkPage();
                    doc.text(line, margin, yPos);
                    yPos += lineHeight;
                });
                doc.setTextColor(0, 0, 0);
            }

            function addSection(title) {
                yPos += 8;
                checkPage(25);
                doc.setFillColor(255, 107, 0);
                doc.rect(margin, yPos - 6, maxWidth, 10, 'F');
                doc.setFontSize(13);
                doc.setTextColor(255, 255, 255);
                doc.setFont(undefined, 'bold');
                doc.text(title, margin + 3, yPos);
                yPos += 12;
                doc.setFontSize(10);
                doc.setTextColor(0, 0, 0);
                doc.setFont(undefined, 'normal');
            }

            function addKeyValue(key, value, bold = false) {
                checkPage();
                doc.setFontSize(10);
                doc.setFont(undefined, 'normal');
                doc.setTextColor(80, 80, 80);
                doc.text(key + ':', margin, yPos);
                doc.setFont(undefined, bold ? 'bold' : 'normal');
                doc.setTextColor(0, 0, 0);
                doc.text(String(value), margin + 55, yPos);
                yPos += 7;
            }

            // IMPROVED: Simplified and fixed - no longer uses promises that can hang
            function addPhotoSync(photoData, caption, maxWidth = 170, maxHeight = 127) {
                if (!photoData) return;

                checkPage(maxHeight + 15);
                doc.setFontSize(9);
                doc.setFont(undefined, 'italic');
                doc.setTextColor(100, 100, 100);
                doc.text(caption, margin, yPos);
                yPos += 5;

                try {
                    // Try to add image directly - jsPDF can handle base64
                    // Calculate dimensions to prevent distortion
                    const img = new Image();
                    img.src = photoData;

                    const imgAspect = img.naturalWidth && img.naturalHeight ?
                        img.naturalWidth / img.naturalHeight : 1.5;
                    const targetAspect = maxWidth / maxHeight;

                    let finalWidth, finalHeight;

                    if (imgAspect > targetAspect) {
                        finalWidth = maxWidth;
                        finalHeight = maxWidth / imgAspect;
                    } else {
                        finalHeight = maxHeight;
                        finalWidth = maxHeight * imgAspect;
                    }

                    const xOffset = margin + (maxWidth - finalWidth) / 2;

                    doc.addImage(photoData, 'JPEG', xOffset, yPos, finalWidth, finalHeight);
                    yPos += finalHeight + 5;
                } catch (e) {
                    console.error('Photo error:', e);
                    doc.setTextColor(220, 53, 69);
                    doc.text('(Photo skipped)', margin, yPos);
                    yPos += 10;
                }
                doc.setTextColor(0, 0, 0);
            }

            // ===== COVER PAGE WITH SUNVOLT LOGO =====
            loadingProgress.textContent = 'Creating cover page...';

            // Add logo at top (simplified - no await)
            try {
                doc.addImage(SUNVOLT_LOGO, 'PNG', pageWidth / 2 - 15, 15, 30, 30);
            } catch (e) {
                console.log('Logo load error (skipped):', e);
            }

            yPos = 55;

            doc.setFillColor(255, 107, 0);
            doc.rect(0, yPos, pageWidth, 60, 'F');

            doc.setFontSize(28);
            doc.setTextColor(255, 255, 255);
            doc.setFont(undefined, 'bold');
            doc.text('SUNVOLT', pageWidth / 2, yPos + 20, { align: 'center' });
            doc.setFontSize(18);
            doc.text('SITE SURVEY REPORT', pageWidth / 2, yPos + 35, { align: 'center' });
            doc.setFontSize(12);
            doc.setFont(undefined, 'normal');
            doc.text('Solar Installation Assessment', pageWidth / 2, yPos + 48, { align: 'center' });

            yPos = 130;
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            doc.setFont(undefined, 'bold');

            const customerName = document.getElementById('customerName').value || 'N/A';
            const eircode = document.getElementById('eircode').value || 'N/A';
            const dateTime = document.getElementById('dateTime').value;
            const surveyDate = dateTime ? new Date(dateTime).toLocaleDateString('en-IE', {
                day: '2-digit', month: 'long', year: 'numeric'
            }) : 'N/A';

            doc.text('PROPERTY DETAILS', pageWidth / 2, yPos, { align: 'center' });
            yPos += 15;

            doc.setFontSize(11);
            doc.setFont(undefined, 'normal');
            addKeyValue('Customer', customerName, true);
            addKeyValue('Location', eircode, true);
            addKeyValue('Survey Date', surveyDate);
            addKeyValue('Report Generated', new Date().toLocaleDateString('en-IE', {
                day: '2-digit', month: 'long', year: 'numeric'
            }));

            yPos = pageHeight - 40;
            doc.setFontSize(9);
            doc.setTextColor(120, 120, 120);
            doc.text('This report contains confidential information', pageWidth / 2, yPos, { align: 'center' });
            yPos += 5;
            doc.text('Sunvolt - Professional Solar Solutions', pageWidth / 2, yPos, { align: 'center' });

            addPageNumber();
            doc.addPage();
            yPos = 20;

            // ===== EXECUTIVE SUMMARY (NO EMOJIS) =====
            loadingProgress.textContent = 'Adding executive summary...';
            addSection('EXECUTIVE SUMMARY');

            const roofCards = document.querySelectorAll('.roof-card');
            let totalActualPanels = 0;
            let totalOptimisers = 0;

            roofCards.forEach(card => {
                const num = card.getAttribute('data-roof');
                totalActualPanels += parseInt(document.getElementById('roofPanels' + num).value) || 0;
                totalOptimisers += parseInt(document.getElementById('roofOptimisers' + num).value) || 0;
            });

            const batteryKwh = document.getElementById('batteryKwh').value;
            const inverterType = document.querySelector('input[name="inverterType"]:checked');

            doc.setFillColor(240, 248, 255);
            doc.rect(margin, yPos - 3, maxWidth, 45, 'F');
            yPos += 5;

            addKeyValue('Total Solar Panels', totalActualPanels || 'Not specified', true);
            addKeyValue('Optimisers', totalOptimisers || 'None');
            addKeyValue('Battery Storage', batteryKwh ? batteryKwh + ' kWh' : 'Not included');
            addKeyValue('Inverter Type', inverterType?.value || 'Not specified');
            addKeyValue('Number of Roofs', roofCards.length);

            yPos += 10;

            // ===== SYSTEM CHECKS (NO EMOJIS) =====
            loadingProgress.textContent = 'Adding system checks...';
            addSection('SYSTEM VERIFICATION');

            const checks = {
                wifiSignal: 'WiFi Signal Strength',
                earthingRod: 'Earthing Rod Present',
                gasMeter: 'Gas Meter Bonding',
                fuseboard: 'Fuseboard Suitability',
                electricalMeter: 'Electrical Meter Compliance',
                waterTank: 'Water Tank Bonding'
            };

            Object.entries(checks).forEach(([key, label]) => {
                const radio = document.querySelector(`input[name="${key}"]:checked`);
                const status = radio ? radio.value : 'Not Checked';

                checkPage();
                doc.setFontSize(10);

                if (status === 'Yes') {
                    doc.setFillColor(40, 167, 69);
                    doc.circle(margin + 2, yPos - 2, 2, 'F');
                } else if (status === 'No') {
                    doc.setFillColor(220, 53, 69);
                    doc.circle(margin + 2, yPos - 2, 2, 'F');
                } else {
                    doc.setDrawColor(150, 150, 150);
                    doc.circle(margin + 2, yPos - 2, 2, 'D');
                }

                doc.setTextColor(0, 0, 0);
                doc.setFont(undefined, 'normal');
                doc.text(label, margin + 8, yPos);
                doc.setFont(undefined, 'bold');
                doc.text(status, margin + 100, yPos);
                yPos += 7;
            });

            yPos += 5;
            const systemNotes = document.getElementById('systemNotes').value;
            if (systemNotes) {
                doc.setFont(undefined, 'bold');
                doc.text('Additional Observations:', margin, yPos);
                yPos += 6;
                doc.setFont(undefined, 'normal');
                addText(systemNotes);
                yPos += 5;
            }

            // ===== ROOF ASSESSMENT (NO EMOJIS) =====
            loadingProgress.textContent = 'Adding roof assessments...';
            addSection('ROOF ASSESSMENT');

            roofCards.forEach((card, index) => {
                const num = card.getAttribute('data-roof');

                if (index > 0) yPos += 5;

                checkPage(40);
                doc.setFillColor(248, 249, 250);
                doc.rect(margin, yPos - 3, maxWidth, 8, 'F');
                doc.setFontSize(11);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(255, 107, 0);
                doc.text(`Roof #${num}`, margin + 2, yPos + 2);
                yPos += 10;
                doc.setTextColor(0, 0, 0);
                doc.setFontSize(10);

                const condition = document.querySelector(`input[name="roofCondition${num}"]:checked`);
                const length = document.getElementById('roofLength' + num).value;
                const width = document.getElementById('roofWidth' + num).value;
                const panels = document.getElementById('roofPanels' + num).value;
                const optimisers = document.getElementById('roofOptimisers' + num).value;
                const orientation = document.getElementById('roofOrientation' + num).value;
                const pitch = document.getElementById('roofPitch' + num).value;
                const notes = document.getElementById('roofNotes' + num).value;

                if (condition) addKeyValue('Condition', condition.value);
                if (length && width) {
                    const area = (parseFloat(length) * parseFloat(width)).toFixed(2);
                    addKeyValue('Dimensions', `${length}m × ${width}m (${area}m²)`);
                }
                if (panels) addKeyValue('Solar Panels', panels, true);
                if (optimisers) addKeyValue('Optimisers', optimisers);
                if (orientation) addKeyValue('Orientation', orientation + (pitch ? ` at ${pitch}°` : ''));
                if (notes) {
                    doc.setFont(undefined, 'italic');
                    doc.setTextColor(80, 80, 80);
                    addText('Notes: ' + notes);
                    doc.setTextColor(0, 0, 0);
                }

                yPos += 3;
            });

            // ===== CUSTOMER PREFERENCES (NO EMOJIS) =====
            loadingProgress.textContent = 'Adding customer preferences...';
            addSection('CUSTOMER PREFERENCES');

            const epsSwitch = document.getElementById('epsSwitch').checked;
            const eddi = document.getElementById('eddi').checked;
            const birdProtector = document.getElementById('birdProtector').checked;

            addKeyValue('EPS Safety Switch', epsSwitch ? 'Yes' : 'No');
            addKeyValue('Eddi Water Timer', eddi ? 'Yes' : 'No');
            addKeyValue('Bird Protector', birdProtector ? 'Yes' : 'No');

            yPos += 5;
            const preferencesNotes = document.getElementById('preferencesNotes').value;
            if (preferencesNotes) {
                doc.setFont(undefined, 'bold');
                doc.text('Additional Requirements:', margin, yPos);
                yPos += 6;
                doc.setFont(undefined, 'normal');
                addText(preferencesNotes);
                yPos += 5;
            }

            const generalNotes = document.getElementById('generalNotes').value;
            if (generalNotes) {
                addSection('ADDITIONAL NOTES');
                addText(generalNotes);
                yPos += 5;
            }

            // ===== PHOTOS (NO DISTORTION - SIMPLIFIED) =====
            loadingProgress.textContent = 'Adding photographic evidence...';
            const systemPhotoCount = Object.values(allPhotos.systemChecks).filter(p => p).length;

            if (systemPhotoCount > 0) {
                addPageNumber();
                doc.addPage();
                yPos = 20;
                addSection('SYSTEM VERIFICATION PHOTOS');

                for (const [key, label] of Object.entries(checks)) {
                    if (allPhotos.systemChecks[key]) {
                        addPhotoSync(allPhotos.systemChecks[key], label);
                    }
                }
            }

            for (const card of roofCards) {
                const num = card.getAttribute('data-roof');
                const hasPhotos = allPhotos.roofs[num]?.length > 0;
                const canvas = canvases[num];
                let hasSketch = false;

                if (canvas && contexts[num]) {
                    const imgData = contexts[num].getImageData(0, 0, canvas.width, canvas.height).data;
                    for (let i = 3; i < imgData.length; i += 4) {
                        if (imgData[i] !== 0) {
                            hasSketch = true;
                            break;
                        }
                    }
                }

                if (hasPhotos || hasSketch) {
                    checkPage(30);
                    addSection(`ROOF #${num} DOCUMENTATION`);

                    if (hasPhotos) {
                        for (const [index, photo] of allPhotos.roofs[num].entries()) {
                            addPhotoSync(photo, `Roof #${num} - Photo ${index + 1}`);
                        }
                    }

                    if (hasSketch) {
                        addPhotoSync(canvas.toDataURL('image/png'), `Roof #${num} - Technical Sketch`);
                    }
                }
            }

            if (allPhotos.additional.length > 0) {
                checkPage(30);
                addSection('ADDITIONAL DOCUMENTATION');

                for (const [index, photo] of allPhotos.additional.entries()) {
                    addPhotoSync(photo, `Additional Photo ${index + 1}`);
                }
            }

            // ===== FOOTER ON LAST PAGE =====
            addPageNumber();

            yPos = pageHeight - 35;
            doc.setDrawColor(200, 200, 200);
            doc.line(margin, yPos, pageWidth - margin, yPos);
            yPos += 8;

            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.text('This report was generated by Sunvolt - Professional Solar Solutions', pageWidth / 2, yPos, { align: 'center' });
            yPos += 4;
            doc.text(`Report ID: ${Date.now().toString(36).toUpperCase()}`, pageWidth / 2, yPos, { align: 'center' });
            yPos += 4;
            doc.text('All measurements and assessments are subject to final site inspection', pageWidth / 2, yPos, { align: 'center' });

            // ===== SAVE PDF =====
            loadingProgress.textContent = 'Finalizing document...';
            const fileName = `Sunvolt_Site_Survey_${customerName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;

            doc.save(fileName);

            setTimeout(() => {
                loading.classList.remove('active');
                alert(`✅ Professional PDF Report Generated!\n\n${fileName}\n${pageNum} pages`);
            }, 500);
        } catch (error) {
            console.error('PDF Error:', error);
            loading.classList.remove('active');
            alert('❌ PDF Generation Error: ' + error.message);
        }
    }, 500);
});

// ==================== EXPORT JSON ====================
document.getElementById('exportJSON').addEventListener('click', () => {
    const data = collectSurveyData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const customerName = document.getElementById('customerName').value || 'Survey';
    a.download = `Sunvolt_Data_${customerName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    saveToHistory();
});

// ==================== SHARE ====================
document.getElementById('shareSurvey').addEventListener('click', async () => {
    if (!navigator.share) {
        alert('Sharing not supported on this device');
        return;
    }

    try {
        await navigator.share({
            title: 'Sunvolt Site Survey Report',
            text: `Survey for ${document.getElementById('customerName').value || 'Customer'}`
        });
    } catch (err) {
        console.log('Share cancelled');
    }
});

// ==================== RESET ====================
document.getElementById('resetSurvey').addEventListener('click', () => {
    if (confirm('Start new survey?\n\nCurrent data will be saved to history.')) {
        saveToHistory();
        localStorage.removeItem('solarSurveyDraft');
        location.reload();
    }
});

// ==================== SAVE/LOAD PROGRESS (JSON) ====================
function saveProgressJSON() {
    const data = collectSurveyData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    const customerName = document.getElementById('customerName').value || 'Progress';
    const timestamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(/:/g, '-');
    a.download = `Sunvolt_Progress_${customerName.replace(/\s+/g, '_')}_${timestamp}.json`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Show success message
    const indicator = document.getElementById('autoSaveIndicator');
    indicator.textContent = '✓ Progress saved';
    indicator.classList.add('show');
    setTimeout(() => {
        indicator.classList.remove('show');
        indicator.textContent = '✓ Auto-saved';
    }, 3000);

    console.log('✅ Progress saved to JSON file');
}

function loadProgressJSON() {
    const fileInput = document.getElementById('jsonFileInput');
    fileInput.click();
}

function handleJSONFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
        alert('❌ Please select a valid JSON file');
        return;
    }

    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);

            // Validate data structure
            if (!data.metadata || !data.metadata.customerName) {
                throw new Error('Invalid survey data format');
            }

            // Confirm before loading
            const confirmMsg = `Load survey for "${data.metadata.customerName}"?\n\nCurrent progress will be replaced.`;
            if (!confirm(confirmMsg)) {
                return;
            }

            // Load the data
            loadSurveyData(data);

            // Show success message
            const indicator = document.getElementById('autoSaveIndicator');
            indicator.textContent = '✓ Progress loaded';
            indicator.style.background = '#00B0FF';
            indicator.classList.add('show');
            setTimeout(() => {
                indicator.classList.remove('show');
                indicator.style.background = 'var(--success)';
                indicator.textContent = '✓ Auto-saved';
            }, 3000);

            console.log('✅ Progress loaded from JSON file');

            // Reset current section to beginning
            currentSection = 1;
            updateSection();

        } catch (error) {
            console.error('JSON load error:', error);
            alert('❌ Error loading file:\n\n' + error.message + '\n\nPlease make sure you selected a valid Sunvolt survey JSON file.');
        }
    };

    reader.onerror = function() {
        alert('❌ Error reading file. Please try again.');
    };

    reader.readAsText(file);

    // Reset file input
    event.target.value = '';
}

// ==================== EVENT LISTENERS ====================
document.getElementById('saveProgressBtn').addEventListener('click', saveProgressJSON);
document.getElementById('loadProgressBtn').addEventListener('click', loadProgressJSON);
document.getElementById('jsonFileInput').addEventListener('change', handleJSONFileUpload);
document.getElementById('historyBtn').addEventListener('click', openHistoryModal);
document.getElementById('gdriveBtn').addEventListener('click', openGDriveModal);

// ==================== INITIALIZATION ====================
document.getElementById('dateTime').value = new Date().toISOString().slice(0, 16);
addRoof();
initRadios();
updateSection();
updatePhotoCount();
loadDraft();

// Initialize Google API
if (typeof gapi !== 'undefined') {
    initGoogleAPI();
}

console.log('✅ Sunvolt Site Survey - Professional Edition v4.0');
console.log('🚀 Features: Fixed image distortion, Sunvolt branding, Professional PDF, Auto-save, Dark Mode');
