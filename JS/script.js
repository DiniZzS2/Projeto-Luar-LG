// Database simulation using LocalStorage
class EPIDatabase {
    constructor() {
        this.epis = this.loadEPIs();
        this.movements = this.loadMovements();
    }

    loadEPIs() {
        const data = localStorage.getItem('epis');
        return data ? JSON.parse(data) : [];
    }

    loadMovements() {
        const data = localStorage.getItem('movements');
        return data ? JSON.parse(data) : [];
    }

    saveEPIs() {
        localStorage.setItem('epis', JSON.stringify(this.epis));
    }

    saveMovements() {
        localStorage.setItem('movements', JSON.stringify(this.movements));
    }

    addEPI(epi) {
        epi.id = Date.now().toString();
        epi.createdAt = new Date().toISOString();
        this.epis.push(epi);
        this.saveEPIs();
        return epi;
    }

    updateEPI(id, updates) {
        const index = this.epis.findIndex(e => e.id === id);
        if (index !== -1) {
            this.epis[index] = { ...this.epis[index], ...updates };
            this.saveEPIs();
            return this.epis[index];
        }
        return null;
    }

    deleteEPI(id) {
        this.epis = this.epis.filter(e => e.id !== id);
        this.saveEPIs();
    }

    getEPI(id) {
        return this.epis.find(e => e.id === id);
    }

    getAllEPIs() {
        return this.epis;
    }

    addMovement(movement) {
        movement.id = Date.now().toString();
        movement.timestamp = new Date().toISOString();
        this.movements.push(movement);
        this.saveMovements();
        return movement;
    }

    getAllMovements() {
        return this.movements.sort((a, b) =>
            new Date(b.timestamp) - new Date(a.timestamp)
        );
    }
}


// Initialize database
const db = new EPIDatabase();

// Configuração do Flatpickr
const flatpickrConfig = {
    enableTime: false,
    dateFormat: "Y-m-d", // Formato AAAA-MM-DD
    altInput: true,      // Mostra um formato amigável para o usuário
    altFormat: "d/m/Y",  // Formato DD/MM/AAAA
    locale: "pt"
};


// Category icons mapping
const categoryIcons = {
    'Hortifruti': 'fa-solid fa-carrot',
    'Laticínios': 'fa-solid fa-cow',
    'Carnes': 'fa-solid fa-drumstick-bite',
    'Grãos': 'fa-solid fa-bread-slice',
    'Congelados': 'fa-solid fa-snowflake',
    'Outros': 'fa-solid fa-layer-group'
};


// Navigation
function switchSection(sectionName) {
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.section === sectionName) {
            btn.classList.add('active');
        }
    });

    // Update sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionName).classList.add('active');

    // Update dynamic content
    if (sectionName === 'dashboard') {
        renderEPIs();
    } else if (sectionName === 'movement') {
        populateMovementSelect();
    } else if (sectionName === 'history') {
        renderHistory();
        populateHistoryFilters();
    }
}


// Nav button event listeners
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Verifica se o botão tem 'data-section', senão ignora (para botões de exportar, etc.)
        if (btn.dataset.section) {
            switchSection(btn.dataset.section);
        }
    });
});


// Register Form
document.getElementById('registerForm').addEventListener('submit', (e) => {
    e.preventDefault();

    const epi = {
        name: document.getElementById('epiName').value,
        category: document.getElementById('epiCategory').value,
        code: document.getElementById('epiCode').value || 'N/A',
        quantity: parseInt(document.getElementById('epiQuantity').value),
        minStock: parseInt(document.getElementById('epiMinStock').value),
        location: document.getElementById('epiLocation').value || 'Não especificado',
        validade: document.getElementById('epiValidade').value || '', // Campo de validade
        description: document.getElementById('epiDescription').value || ''
    };

    db.addEPI(epi);

    // Register initial movement if quantity > 0
    if (epi.quantity > 0) {
        db.addMovement({
            epiId: db.epis[db.epis.length - 1].id,
            epiName: epi.name,
            type: 'entrada',
            quantity: epi.quantity,
            responsible: 'Sistema',
            reason: 'Cadastro inicial',
            stockAfter: epi.quantity
        });
    }

    showToast('Alimento cadastrado com sucesso!', 'success');
    e.target.reset();
    flatpickr("#epiValidade", flatpickrConfig).clear(); // Limpa o calendário
    updateStats();
});


// Movement Form
document.getElementById('movementForm').addEventListener('submit', (e) => {
    e.preventDefault();

    const epiId = document.getElementById('movementEpi').value;
    const type = document.getElementById('movementType').value;
    const quantity = parseInt(document.getElementById('movementQuantity').value);
    const responsible = document.getElementById('movementResponsible').value;
    const reason = document.getElementById('movementReason').value || 'Sem observação';

    const epi = db.getEPI(epiId);

    if (!epi) {
        showToast('Alimento não encontrado!', 'error');
        return;
    }

    // Validate stock for output
    if (type === 'saida' && quantity > epi.quantity) {
        showToast('Quantidade insuficiente em estoque!', 'error');
        return;
    }

    // Update quantity
    const newQuantity = type === 'entrada'
        ? epi.quantity + quantity
        : epi.quantity - quantity;

    db.updateEPI(epiId, { quantity: newQuantity });

    // Register movement
    db.addMovement({
        epiId: epi.id,
        epiName: epi.name,
        type: type,
        quantity: quantity,
        responsible: responsible,
        reason: reason,
        stockAfter: newQuantity
    });

    showToast(
        `Movimentação registrada! ${type === 'entrada' ? 'Entrada' : 'Saída'} de ${quantity} unidades.`,
        'success'
    );

    e.target.reset();
    document.getElementById('currentStockInfo').style.display = 'none';
    updateStats();
    renderEPIs();
});


// Movement EPI select change
document.getElementById('movementEpi').addEventListener('change', (e) => {
    const epiId = e.target.value;
    const infoDiv = document.getElementById('currentStockInfo');

    if (epiId) {
        const epi = db.getEPI(epiId);
        document.getElementById('currentStockValue').textContent = epi.quantity;
        infoDiv.style.display = 'flex';
    } else {
        infoDiv.style.display = 'none';
    }
});


// Populate movement select
function populateMovementSelect() {
    const select = document.getElementById('movementEpi');
    select.innerHTML = '<option value="">Selecione um alimento...</option>';

    db.getAllEPIs().forEach(epi => {
        const option = document.createElement('option');
        option.value = epi.id;
        option.textContent = `${epi.name} - Estoque: ${epi.quantity}`;
        select.appendChild(option);
    });
}


// Render EPIs in dashboard
function renderEPIs(filter = '') {
    const grid = document.getElementById('episGrid');
    const emptyState = document.getElementById('emptyState');

    let epis = db.getAllEPIs();

    if (filter) {
        epis = epis.filter(epi =>
            epi.name.toLowerCase().includes(filter.toLowerCase()) ||
            epi.category.toLowerCase().includes(filter.toLowerCase()) ||
            (epi.code && epi.code.toLowerCase().includes(filter.toLowerCase()))
        );
    }

    if (epis.length === 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'flex';
        return;
    }

    grid.style.display = 'grid';
    emptyState.style.display = 'none';

    grid.innerHTML = epis.map(epi => {
        const isLowStock = epi.quantity <= epi.minStock;
        const isCritical = epi.quantity === 0;
        const stockClass = isCritical ? 'critical' : (isLowStock ? 'low' : '');
        const cardClass = isLowStock ? 'low-stock' : (isCritical ? 'critical-stock' : ''); // Adicionado critical-stock

        return `
            <div class="epi-card ${cardClass}">
                <div class="epi-header">
                    <div class="epi-icon">
                        <i class="fas ${categoryIcons[epi.category] || 'fa-shield-halved'}"></i>
                    </div>
                    <div class="epi-actions">
                        <button class="icon-btn" onclick="openEditModal('${epi.id}')" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </div>
                <div class="epi-info">
                    <h3>${epi.name}</h3>
                    <span class="epi-category">${epi.category}</span>
                    <div class="epi-details">
                        <div class="epi-detail">
                            <span class="epi-detail-label">Lote:</span>
                            <span class="epi-detail-value">${epi.code}</span>
                        </div>
                        <div class="epi-detail">
                            <span class="epi-detail-label">Estoque:</span>
                            <span class="epi-detail-value stock-quantity ${stockClass}">
                                ${epi.quantity} un
                            </span>
                        </div>
                        <div class="epi-detail">
                            <span class="epi-detail-label">Estoque Mínimo:</span>
                            <span class="epi-detail-value">${epi.minStock} un</span>
                        </div>
                        <div class="epi-detail">
                            <span class="epi-detail-label">Localização:</span>
                            <span class="epi-detail-value">${epi.location}</span>
                        </div>
                        <div class="epi-detail">
                            <span class="epi-detail-label">Validade:</span>
                            <span class="epi-detail-value">${epi.validade || 'N/A'}</span>
                        </div>
                    </div>
                    ${epi.description ? `<p style="margin-top: 1rem; color: var(--text-secondary); font-size: 0.9rem;">${epi.description}</p>` : ''}
                </div>
            </div>
        `;
    }).join('');
}


// Search EPIs
document.getElementById('searchAlim').addEventListener('input', (e) => {
    renderEPIs(e.target.value);
});


// Modal functions
function openEditModal(epiId) {
    const epi = db.getEPI(epiId);
    if (!epi) return;

    document.getElementById('editEpiId').value = epi.id;
    document.getElementById('editEpiName').value = epi.name;
    document.getElementById('editEpiCategory').value = epi.category;
    document.getElementById('editEpiCode').value = epi.code;
    document.getElementById('editEpiMinStock').value = epi.minStock;
    document.getElementById('editEpiLocation').value = epi.location;
    document.getElementById('editEpiValidade').value = epi.validade || ''; // Campo de validade
    document.getElementById('editEpiDescription').value = epi.description;

    document.getElementById('epiModal').classList.add('active');
}

function closeModal() {
    document.getElementById('epiModal').classList.remove('active');
}


// Edit form submit
document.getElementById('editForm').addEventListener('submit', (e) => {
    e.preventDefault();

    const id = document.getElementById('editEpiId').value;
    const updates = {
        name: document.getElementById('editEpiName').value,
        category: document.getElementById('editEpiCategory').value,
        code: document.getElementById('editEpiCode').value,
        minStock: parseInt(document.getElementById('editEpiMinStock').value),
        location: document.getElementById('editEpiLocation').value,
        validade: document.getElementById('editEpiValidade').value || '', // Campo de validade
        description: document.getElementById('editEpiDescription').value
    };

    db.updateEPI(id, updates);
    showToast('Alimento atualizado com sucesso!', 'success');
    closeModal();
    renderEPIs();
    updateStats();
});


// Delete EPI
function deleteEpi() {
    if (!confirm('Tem certeza que deseja excluir este alimento? Esta ação não pode ser desfeita.')) {
        return;
    }

    const id = document.getElementById('editEpiId').value;
    db.deleteEPI(id);
    showToast('Alimento excluído com sucesso!', 'success');
    closeModal();
    renderEPIs();
    updateStats();
}


// Close modal on outside click
document.getElementById('epiModal').addEventListener('click', (e) => {
    if (e.target.id === 'epiModal') {
        closeModal();
    }
});


// Render history
function renderHistory(filterType = 'all', filterEpi = 'all') {
    const tbody = document.getElementById('historyTableBody');
    const emptyHistory = document.getElementById('emptyHistory');

    let movements = db.getAllMovements();

    // Apply filters
    if (filterType !== 'all') {
        movements = movements.filter(m => m.type === filterType);
    }
    if (filterEpi !== 'all') {
        movements = movements.filter(m => m.epiId === filterEpi);
    }

    if (movements.length === 0) {
        tbody.innerHTML = '';
        emptyHistory.style.display = 'flex';
        return;
    }

    emptyHistory.style.display = 'none';

    tbody.innerHTML = movements.map(movement => {
        const date = new Date(movement.timestamp);
        const typeClass = movement.type === 'entrada' ? 'success' : 'danger';
        const typeIcon = movement.type === 'entrada' ? 'fa-arrow-down' : 'fa-arrow-up';

        return `
            <tr>
                <td>${date.toLocaleString('pt-BR')}</td>
                <td><strong>${movement.epiName}</strong></td>
                <td>
                    <span class="badge badge-${typeClass}">
                        <i class="fas ${typeIcon}"></i>
                        ${movement.type.toUpperCase()}
                    </span>
                </td>
                <td><strong>${movement.quantity}</strong></td>
                <td>${movement.responsible}</td>
                <td>${movement.reason}</td>
                <td><strong>${movement.stockAfter}</strong></td>
            </tr>
        `;
    }).join('');
}


// Populate history filters
function populateHistoryFilters() {
    const select = document.getElementById('filterEpi');
    select.innerHTML = '<option value="all">Todos os alimentos</option>';

    db.getAllEPIs().forEach(epi => {
        const option = document.createElement('option');
        option.value = epi.id;
        option.textContent = epi.name;
        select.appendChild(option);
    });
}


// History filters
document.getElementById('filterType').addEventListener('change', (e) => {
    const filterEpi = document.getElementById('filterEpi').value;
    renderHistory(e.target.value, filterEpi);
});

document.getElementById('filterEpi').addEventListener('change', (e) => {
    const filterType = document.getElementById('filterType').value;
    renderHistory(filterType, e.target.value);
});


// Update statistics
function updateStats() {
    const epis = db.getAllEPIs();
    const totalQuantity = epis.reduce((sum, epi) => sum + epi.quantity, 0);
    const lowStock = epis.filter(epi => epi.quantity <= epi.minStock).length;

    document.getElementById('totalAlim').textContent = totalQuantity;
    document.getElementById('lowStock').textContent = lowStock;
}


// Toast notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}


// Initialize app
function init() {
    renderEPIs();
    updateStats();
    populateMovementSelect();
    populateHistoryFilters();
    renderHistory();
}

// Funções de Importar/Exportar
function baixarArquivo(nomeArquivo, conteudo) {
    const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function exportarDados() {
    const dados = {
        epis: db.epis || [],
        movements: db.movements || [],
        dataExportacao: new Date().toISOString(),
        versao: '1.0'
    };
    
    const json = JSON.stringify(dados, null, 2);
    const dataFormatada = new Date().toISOString().split('T')[0];
    baixarArquivo(`backup-epis-${dataFormatada}.json`, json);
    showToast('✅ Dados exportados!', 'success');
}

function importarDados() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (evento) => {
            try {
                const dados = JSON.parse(evento.target.result);
                
                if (!dados.epis || !dados.movements) {
                    alert('❌ Arquivo inválido!');
                    return;
                }
                
                if (confirm('⚠️ Substituir todos os dados?')) {
                    localStorage.setItem('epis', JSON.stringify(dados.epis));
                    localStorage.setItem('movements', JSON.stringify(dados.movements));
                    showToast('✅ Dados importados!', 'success');
                    setTimeout(() => location.reload(), 1500);
                }
            } catch (erro) {
                alert('❌ Erro ao importar!');
            }
        };
        reader.readAsText(file);
    };
    
    input.click();
}

function gerarRelatorioEstoqueBaixo() {
    const epis = db.getAllEPIs();
    const episBaixos = epis.filter(epi => epi.quantity <= epi.minStock);
    
    if (episBaixos.length === 0) {
        showToast('✅ Nenhum alimento com estoque baixo!', 'success');
        return;
    }
    
    let relatorio = `RELATÓRIO DE ESTOQUE BAIXO - ${new Date().toLocaleString('pt-BR')}\n${'='.repeat(70)}\n\n`;
    
    episBaixos.forEach((epi, i) => {
        relatorio += `${i + 1}. ${epi.name}\n`;
        relatorio += `   Estoque: ${epi.quantity} (mínimo: ${epi.minStock})\n`;
        relatorio += `   Categoria: ${epi.category}\n`;
        relatorio += `   Localização: ${epi.location}\n\n`;
    });
    
    relatorio += `Total: ${episBaixos.length} Alimentos\n`; // Corrigido de EPIs para Alimentos
    
    baixarArquivo(`relatorio-${new Date().toISOString().split('T')[0]}.txt`, relatorio);
    showToast(`📄 Relatório: ${episBaixos.length} itens`, 'success');
}


// [AQUI ESTÁ A MUDANÇA PRINCIPAL]
// Run on load
document.addEventListener('DOMContentLoaded', () => {
    // Inicializa o app principal
    init();

    // Tenta inicializar os calendários
    // Isso agora vai funcionar, pois o flatpickr.js carregou ANTES deste script.
    try {
        flatpickr("#epiValidade", flatpickrConfig);
        flatpickr("#editEpiValidade", flatpickrConfig);
    } catch (e) {
        console.error("Erro ao inicializar o Flatpickr:", e);
        // Opcional: Mostrar um alerta para o usuário se o calendário falhar
        // alert("Não foi possível carregar o calendário. Verifique a conexão com a internet.");
    }
});