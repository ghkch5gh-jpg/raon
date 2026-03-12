// Supabase Configuration
const supabaseUrl = 'https://oopkfvaaqotdbnbslnht.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vcGtmdmFhcW90ZGJuYnNsbmh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyODYyODgsImV4cCI6MjA4ODg2MjI4OH0.P64dxurSQj-bPOJjZp4Z0FZfEzOofRlaqqbUvBSK0g0';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// State Management
let transactions = [];
let memos = {}; // { 'YYYY-MM-DD': '메모 내용' }
let fixedExpenses = [];
let loans = [];

// App Settings (will be loaded from Supabase soon, use defaults meanwhile)
let appTitle = '우리의 가계부';
let appLogoEmoji = '👛';
let personAEmoji = '👨';
let personBEmoji = '👩';
let appPassword = '0716';

let customCategories = [
    { id: '1', name: '식비', color: '#ef4444' },
    { id: '2', name: '교통비', color: '#3b82f6' },
    { id: '3', name: '주거비', color: '#8b5cf6' },
    { id: '4', name: '쇼핑', color: '#ec4899' },
    { id: '5', name: '문화생활', color: '#f59e0b' },
    { id: '6', name: '저축/투자', color: '#10b981' },
    { id: '7', name: '급여', color: '#0ea5e9' },
    { id: '8', name: '기타', color: '#64748b' }
];

// Calendar State
let currentCalDate = new Date();
let currentYear = currentCalDate.getFullYear();
let currentMonth = currentCalDate.getMonth(); // 0-indexed

// List View State
let currentListYear = currentYear;
let currentListMonth = currentMonth;

// Analysis View State
let currentAnalysisYear = currentYear;
let currentAnalysisMonth = currentMonth;

// Modal State
let activeModalDate = null;
let activeLoanId = null;

// DOM Elements
const form = document.getElementById('transaction-form');
const listEl = document.getElementById('transaction-list');
const filterPersonEl = document.getElementById('filter-person');

// Fixed Expenses Elements
const fixedFormA = document.getElementById('fixed-form-a');
const fixedFormB = document.getElementById('fixed-form-b');
const fixedListA = document.getElementById('fixed-list-a');
const fixedListB = document.getElementById('fixed-list-b');
const fixedTotalA = document.getElementById('fixed-total-a');
const fixedTotalB = document.getElementById('fixed-total-b');

// Loan Elements
const loanForm = document.getElementById('loan-form');
const loanList = document.getElementById('loan-list');
const totalLoanAmount = document.getElementById('total-loan-amount');

// Summary Elements
const els = {
    totalBalance: document.getElementById('total-balance'),
    totalIncome: document.getElementById('total-income'),
    totalExpense: document.getElementById('total-expense'),
    personAIncome: document.getElementById('person-a-income'),
    personAExpense: document.getElementById('person-a-expense'),
    personBIncome: document.getElementById('person-b-income'),
    personBExpense: document.getElementById('person-b-expense'),
};

// Format Currency
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount);
};

// Initialize App
async function init() {
    try {
        // Fetch Settings
        const { data: settingsData, error: setErr } = await supabaseClient.from('app_settings').select('*').limit(1).single();
        if (settingsData && !setErr) {
            appTitle = settingsData.app_title || appTitle;
            appLogoEmoji = settingsData.app_logo || appLogoEmoji;
            personAEmoji = settingsData.person_a_emoji || personAEmoji;
            personBEmoji = settingsData.person_b_emoji || personBEmoji;
            appPassword = settingsData.app_password || appPassword;
        }

        // Fetch Categories
        const { data: catsData } = await supabaseClient.from('custom_categories').select('*');
        if (catsData && catsData.length > 0) customCategories = catsData;

        // Fetch Transactions
        const { data: txsData } = await supabaseClient.from('transactions').select('*').order('created_at', { ascending: false });
        if (txsData) transactions = txsData;

        // Fetch Fixed Expenses
        const { data: fixedData } = await supabaseClient.from('fixed_expenses').select('*').order('created_at', { ascending: true });
        if (fixedData) fixedExpenses = fixedData;

        // Fetch Loans
        const { data: loansData } = await supabaseClient.from('loans').select('*').order('created_at', { ascending: true });
        if (loansData) loans = loansData;

        // Fetch Memos
        const { data: memosData } = await supabaseClient.from('memos').select('*');
        if (memosData) {
            memosData.forEach(m => memos[m.date] = m.content);
        }

    } catch (err) {
        console.error('Failed to load data from Supabase:', err);
    }

    // Setup App Title
    const titleEl = document.getElementById('app-title-text');
    const editTitleBtn = document.getElementById('edit-title-btn');
    if (titleEl) titleEl.textContent = appTitle;
    
    const handleTitleEdit = async () => {
        const newTitle = prompt('새로운 가계부 제목을 입력하세요:', appTitle);
        if (newTitle !== null && newTitle.trim() !== '') {
            appTitle = newTitle.trim();
            if (titleEl) titleEl.textContent = appTitle;
            await supabaseClient.from('app_settings').update({ app_title: appTitle }).eq('id', 1);
        }
    };
    if (titleEl) titleEl.addEventListener('click', handleTitleEdit);
    if (editTitleBtn) editTitleBtn.addEventListener('click', handleTitleEdit);

    // Set default date to today
    document.getElementById('date').valueAsDate = new Date();
    
    // Event Listeners
    form.addEventListener('submit', handleAddTransaction);
    filterPersonEl.addEventListener('change', render);

    // Init Tabs
    initTabs();

    // Init FAB Modals
    initFabModals();

    // Init Calendar & Modal & Emoji
    initCalendar();
    initMemoModal();
    initLoanModal();
    initListMonthSelector();
    initEmojiModal();

    // Init Fixed Expenses Events
    fixedFormA.addEventListener('submit', (e) => handleAddFixed(e, 'A'));
    fixedFormB.addEventListener('submit', (e) => handleAddFixed(e, 'B'));

    // Init Loan Events
    loanForm.addEventListener('submit', handleAddLoan);

    // Init Analysis Events
    initAnalysis();

    // Init Password Setting Evenets
    const passwordForm = document.getElementById('password-form');
    if (passwordForm) {
        passwordForm.addEventListener('submit', handlePasswordUpdate);
    }

    // Check Session Auth
    checkAuthentication();
}

function checkAuthentication() {
    const lockScreen = document.getElementById('lock-screen');
    const mainApp = document.getElementById('main-app-container');
    const lockForm = document.getElementById('lock-form');
    const lockInput = document.getElementById('lock-password-input');
    const lockError = document.getElementById('lock-error-msg');

    if (!lockScreen || !mainApp) return;

    // Check if recently authenticated in this session
    if (sessionStorage.getItem('isAuthenticated') === 'true') {
        lockScreen.style.display = 'none';
        mainApp.style.display = 'flex';
        render();
        return;
    }

    // Not authenticated -> Show lock screen
    lockScreen.style.display = 'flex';
    mainApp.style.display = 'none';

    if (lockForm) {
        lockForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const inputVal = lockInput.value.trim();
            if (inputVal === appPassword) {
                // Success
                sessionStorage.setItem('isAuthenticated', 'true');
                lockScreen.style.display = 'none';
                mainApp.style.display = 'flex';
                render();
            } else {
                // Fail
                lockError.style.display = 'block';
                lockInput.value = '';
                lockInput.focus();
            }
        });
    }
}

// Update App Password
async function handlePasswordUpdate(e) {
    e.preventDefault();
    const newPwd = document.getElementById('new-password').value.trim();
    if (newPwd.length !== 4) {
        alert('비밀번호는 4자리로 입력해주세요.');
        return;
    }

    // Optimistic Update
    appPassword = newPwd;
    document.getElementById('new-password').value = '';
    alert('비밀번호가 변경되었습니다!');

    // DB Update
    const { error } = await supabaseClient.from('app_settings').update({ app_password: appPassword }).eq('id', 1);
    if (error) {
        console.error('Failed to update app password', error);
        alert('서버 저장에 실패했습니다. 다음 접속 시 풀릴 수 있습니다.');
    }
}

// Initialize Tabs
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const fabTx = document.getElementById('fab-add-transaction');
    const fabLoan = document.getElementById('fab-add-loan');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active from all tabs and contents
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Set clicked tab and corresponding content to active
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            document.getElementById(targetId).classList.add('active');

            // Both FABs are globally visible
            if (fabTx) fabTx.style.display = 'flex';
            if (fabLoan) fabLoan.style.display = 'flex';
        });
    });

    // Initialize initial tab state strictly by clicking the first active tab (Dashboard usually)
    const initialTab = document.querySelector('.tab-btn.active') || tabBtns[0];
    if (initialTab) initialTab.click();
}

// Initialize FAB Modals
function initFabModals() {
    // Transaction Modal
    const txModal = document.getElementById('add-transaction-modal');
    const fabAddTx = document.getElementById('fab-add-transaction');
    const closeTxBtn = document.querySelector('.close-add-transaction-modal');

    if (fabAddTx && txModal) {
        fabAddTx.addEventListener('click', () => {
            txModal.style.display = 'flex';
        });
        
        closeTxBtn.addEventListener('click', () => {
            txModal.style.display = 'none';
        });

        txModal.addEventListener('click', (e) => {
            if (e.target === txModal) txModal.style.display = 'none';
        });
    }

    // Loan Modal
    const loanModal = document.getElementById('add-loan-modal');
    const fabAddLoan = document.getElementById('fab-add-loan');
    const closeLoanBtn = document.querySelector('.close-add-loan-modal');

    if (fabAddLoan && loanModal) {
        fabAddLoan.addEventListener('click', () => {
            loanModal.style.display = 'flex';
        });

        closeLoanBtn.addEventListener('click', () => {
            loanModal.style.display = 'none';
        });

        loanModal.addEventListener('click', (e) => {
            if (e.target === loanModal) loanModal.style.display = 'none';
        });
    }
}

// Render everything
function render() {
    renderList();
    renderFixed();
    renderLoans();
    renderCalendar();
    updateCategorySelects();
    renderSettingsCategories();
    renderAnalysis();
    updateSummaries();
    
    // Settings form listener
    const catForm = document.getElementById('category-form');
    if (catForm) {
        catForm.removeEventListener('submit', handleAddCategory);
        catForm.addEventListener('submit', handleAddCategory);
    }
}

// Add Transaction
async function handleAddTransaction(e) {
    e.preventDefault();
    
    const type = document.querySelector('input[name="type"]:checked').value;
    const person = document.querySelector('input[name="person"]:checked').value;
    const date = document.getElementById('date').value;
    const amount = Number(document.getElementById('amount').value);
    const category = document.getElementById('category').value;
    const description = document.getElementById('description').value;

    if (!date || amount <= 0 || !category || !description) {
        alert('모든 필드를 올바르게 입력해주세요.');
        return;
    }

    const newTransaction = {
        type,
        person,
        date,
        amount,
        category,
        description
    };

    // Optimistic UI update
    const uiTx = { ...newTransaction, id: Date.now().toString() };
    transactions.unshift(uiTx);
    
    // Reset inputs
    document.getElementById('amount').value = '';
    document.getElementById('description').value = '';
    
    render();

    // Supabase Insert
    const { data, error } = await supabaseClient.from('transactions').insert([newTransaction]).select();
    if (data && data.length > 0) {
        // Replace optimistic ID with real DB UUID
        const idx = transactions.findIndex(t => t.id === uiTx.id);
        if (idx !== -1) transactions[idx] = data[0];
    } else if (error) {
        console.error('Failed to add transaction:', error);
        alert('저장에 실패했습니다.');
    }

    // Close Modal after success
    const txModal = document.getElementById('add-transaction-modal');
    if (txModal) txModal.style.display = 'none';
}

// Delete Transaction
window.deleteTransaction = async function(id) {
    // Optimistic Delete
    const originalTransactions = [...transactions];
    transactions = transactions.filter(t => t.id !== id);
    render();

    const { error } = await supabaseClient.from('transactions').delete().eq('id', id);
    if (error) {
        console.error('Failed to delete transaction:', error);
        alert('삭제에 실패했습니다.');
        transactions = originalTransactions; // Revert on failure
        render();
    }
}

// Render List
function renderList() {
    const filter = filterPersonEl.value;
    const monthDisplay = document.getElementById('list-month-display');
    
    if (monthDisplay) {
        monthDisplay.textContent = `${currentListYear}. ${String(currentListMonth + 1).padStart(2, '0')}`;
    }
    
    // Filter by selected person AND selected month
    const filteredTransactions = transactions.filter(t => {
        const tDate = new Date(t.date);
        const matchesMonth = tDate.getFullYear() === currentListYear && tDate.getMonth() === currentListMonth;
        const matchesPerson = filter === 'all' || t.person === filter;
        
        return matchesMonth && matchesPerson;
    });
    
    // Calculate and update payment summaries (Only Expenses for this month, ignore person filter for sum)
    let sumA = 0;
    let sumB = 0;
    let sumCommon = 0;
    
    transactions.forEach(t => {
        const tDate = new Date(t.date);
        if (tDate.getFullYear() === currentListYear && tDate.getMonth() === currentListMonth && t.type === 'expense') {
            if (t.person === 'A') sumA += t.amount;
            else if (t.person === 'B') sumB += t.amount;
            else if (t.person === 'Common') sumCommon += t.amount;
        }
    });

    document.getElementById('pay-sum-a').textContent = formatCurrency(sumA);
    document.getElementById('pay-sum-b').textContent = formatCurrency(sumB);
    document.getElementById('pay-sum-common').textContent = formatCurrency(sumCommon);

    listEl.innerHTML = '';

    if (filteredTransactions.length === 0) {
        listEl.innerHTML = '<div class="empty-state">내역이 없습니다.</div>';
        return;
    }

    filteredTransactions.forEach(t => {
        const item = document.createElement('div');
        item.classList.add('transaction-item');
        
        const isIncome = t.type === 'income';
        const iconClass = isIncome ? 'ri-arrow-up-circle-line' : 'ri-arrow-down-circle-line';
        const amountSign = isIncome ? '+' : '-';
        
        let personLabel = '';
        let personColor = '';
        if (t.person === 'A') { personLabel = personAEmoji; personColor = 'var(--color-person-a)'; }
        else if (t.person === 'B') { personLabel = personBEmoji; personColor = 'var(--color-person-b)'; }
        else if (t.person === 'Common') { personLabel = '👫'; personColor = '#f59e0b'; }

        // Find Category Color
        const catObj = customCategories.find(c => c.name === t.category);
        const catColor = catObj ? catObj.color : '#64748b';

        item.innerHTML = `
            <div class="item-left">
                <div class="item-icon" style="background: ${catColor}20; color: ${catColor}; font-weight: 700; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%;">
                    ${personLabel}
                </div>
                <div class="item-details">
                    <span class="item-title">${t.description}</span>
                    <div class="item-meta">
                        <span>${t.date}</span>
                        <span>•</span>
                        <span style="color: ${catColor}; font-weight: 500;">${t.category}</span>
                    </div>
                </div>
            </div>
            <div class="item-right">
                <span class="item-amount ${t.type}">${amountSign} ${formatCurrency(t.amount)}</span>
                <button class="delete-btn" onclick="deleteTransaction('${t.id}')">
                    <i class="ri-delete-bin-line"></i>
                </button>
            </div>
        `;
        listEl.appendChild(item);
    });
}

// Update Summaries
function updateSummaries() {
    // Current month filter for Dashboard Summaries
    const today = new Date();
    const currentListYearStr = currentListYear || today.getFullYear();
    const currentListMonthStr = currentListMonth !== undefined ? currentListMonth : today.getMonth();

    const monthTxs = transactions.filter(t => {
        const d = new Date(t.date);
        return d.getFullYear() === currentListYearStr && d.getMonth() === currentListMonthStr;
    });

    // Total Stats (This month)
    const totalIncome = monthTxs.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const totalExpense = monthTxs.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const balance = totalIncome - totalExpense;

    // Person A Stats (This month)
    const aIncome = monthTxs.filter(t => t.type === 'income' && t.person === 'A').reduce((acc, t) => acc + t.amount, 0);
    const aExpense = monthTxs.filter(t => t.type === 'expense' && t.person === 'A').reduce((acc, t) => acc + t.amount, 0);

    // Person B Stats (This month)
    const bIncome = monthTxs.filter(t => t.type === 'income' && t.person === 'B').reduce((acc, t) => acc + t.amount, 0);
    const bExpense = monthTxs.filter(t => t.type === 'expense' && t.person === 'B').reduce((acc, t) => acc + t.amount, 0);

    // Update DOM
    els.totalBalance.textContent = formatCurrency(balance);
    els.totalIncome.textContent = formatCurrency(totalIncome);
    els.totalExpense.textContent = formatCurrency(totalExpense);
    
    els.personAIncome.textContent = formatCurrency(aIncome);
    els.personAExpense.textContent = formatCurrency(aExpense);
    
    els.personBIncome.textContent = formatCurrency(bIncome);
    els.personBExpense.textContent = formatCurrency(bExpense);
}

// Save to LocalStorage
function saveData() {
    localStorage.setItem('coupleLedger_transactions', JSON.stringify(transactions));
    localStorage.setItem('coupleLedger_memos', JSON.stringify(memos));
    localStorage.setItem('coupleLedger_fixed', JSON.stringify(fixedExpenses));
    localStorage.setItem('coupleLedger_loans', JSON.stringify(loans));
    localStorage.setItem('coupleLedger_categories', JSON.stringify(customCategories));
}

// ---- Category Handling ---- //
function updateCategorySelects() {
    const selector = document.getElementById('category');
    if (!selector) return;
    
    selector.innerHTML = '';
    customCategories.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.name;
        opt.textContent = c.name;
        selector.appendChild(opt);
    });
}

async function handleAddCategory(e) {
    e.preventDefault();
    const nameInput = document.getElementById('cat-name');
    const colorInput = document.getElementById('cat-color');
    const name = nameInput.value.trim();
    const color = colorInput.value;
    
    if (!name) return;
    
    // Prevent duplicates
    if (customCategories.some(c => c.name === name)) {
        alert('이미 존재하는 카테고리입니다.');
        return;
    }
    
    const newCat = { name, color };
    const uiCat = { ...newCat, id: Date.now().toString() };
    customCategories.push(uiCat);
    
    nameInput.value = '';
    render();

    const { data, error } = await supabaseClient.from('custom_categories').insert([newCat]).select();
    if (data && data.length > 0) {
        const idx = customCategories.findIndex(c => c.id === uiCat.id);
        if (idx !== -1) customCategories[idx] = data[0];
    } else if(error) {
        console.error('Failed to add category:', error);
    }
}

window.deleteCategory = async function(id) {
    if(customCategories.length <= 1) {
        alert('최소 1개의 카테고리는 유지되어야 합니다.');
        return;
    }
    const originalCats = [...customCategories];
    customCategories = customCategories.filter(c => c.id !== id);
    render();

    const { error } = await supabaseClient.from('custom_categories').delete().eq('id', id);
    if (error) {
        console.error('Failed to delete category:', error);
        customCategories = originalCats;
        render();
    }
}

function renderSettingsCategories() {
    const list = document.getElementById('category-settings-list');
    if (!list) return;
    
    list.innerHTML = '';
    
    customCategories.forEach(c => {
        const item = document.createElement('div');
        item.className = 'category-settings-item';
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem;">
                <span class="category-color-box" style="background-color: ${c.color}"></span>
                <strong style="color: var(--text-main); font-weight: 500;">${c.name}</strong>
            </div>
            <button class="icon-btn small delete-btn" onclick="deleteCategory('${c.id}')" style="opacity: 1; padding: 0.25rem;">
                <i class="ri-delete-bin-line"></i>
            </button>
        `;
        list.appendChild(item);
    });
}

// ---- Fixed Expenses Logic ---- //
async function handleAddFixed(e, person) {
    e.preventDefault();
    const descId = person === 'A' ? 'fixed-desc-a' : 'fixed-desc-b';
    const amountId = person === 'A' ? 'fixed-amount-a' : 'fixed-amount-b';
    
    const desc = document.getElementById(descId).value;
    const amount = Number(document.getElementById(amountId).value);
    
    if (!desc || amount <= 0) return;
    
    const newFixed = { person, description: desc, amount };
    const uiFixed = { ...newFixed, id: Date.now().toString(), desc }; // keeping 'desc' internally for old code compatibility temporarily
    
    fixedExpenses.push(uiFixed);
    
    document.getElementById(descId).value = '';
    document.getElementById(amountId).value = '';
    
    render();

    const { data, error } = await supabaseClient.from('fixed_expenses').insert([newFixed]).select();
    if (data && data.length > 0) {
        const item = data[0];
        item.desc = item.description; // map back for UI
        const idx = fixedExpenses.findIndex(f => f.id === uiFixed.id);
        if (idx !== -1) fixedExpenses[idx] = item;
    } else if (error) {
        console.error('Failed to add fixed expense:', error);
    }
}

window.deleteFixed = async function(id) {
    const orig = [...fixedExpenses];
    fixedExpenses = fixedExpenses.filter(f => f.id !== id);
    render();

    const { error } = await supabaseClient.from('fixed_expenses').delete().eq('id', id);
    if (error) {
        fixedExpenses = orig;
        render();
        console.error('Failed to delete fixed expense:', error);
    }
}

function renderFixed() {
    const listA = fixedExpenses.filter(f => f.person === 'A');
    const listB = fixedExpenses.filter(f => f.person === 'B');
    
    const renderListHTML = (list, containerId, totalId, personColorClass) => {
        const container = document.getElementById(containerId);
        const totalEl = document.getElementById(totalId);
        
        container.innerHTML = '';
        let total = 0;
        
        if (list.length === 0) {
            container.innerHTML = '<div class="empty-state">등록된 고정 지출이 없습니다.</div>';
        } else {
            list.forEach(f => {
                total += f.amount;
                const item = document.createElement('div');
                item.className = 'fixed-item';
                item.innerHTML = `
                    <span class="fixed-desc">${f.desc}</span>
                    <div class="fixed-item-right">
                        <span class="fixed-amount">${formatCurrency(f.amount)}</span>
                        <button class="delete-btn" style="opacity:1;" onclick="deleteFixed('${f.id}')">
                            <i class="ri-close-circle-line"></i>
                        </button>
                    </div>
                `;
                container.appendChild(item);
            });
        }
        
        totalEl.textContent = formatCurrency(total);
    };
    
    renderListHTML(listA, 'fixed-list-a', 'fixed-total-a', 'person-a');
    renderListHTML(listB, 'fixed-list-b', 'fixed-total-b', 'person-b');
}

// ---- Loan Logic ---- //
async function handleAddLoan(e) {
    e.preventDefault();
    
    const person = document.querySelector('input[name="loan-person"]:checked').value;
    const name = document.getElementById('loan-name').value;
    const amount = Number(document.getElementById('loan-amount').value);
    const paid = Number(document.getElementById('loan-paid').value) || 0;
    const rate = Number(document.getElementById('loan-rate').value) || 0; // removed rate column from sql so omit, or add to db. Assuming DB has it if code does, if not it will fail. Let's send it anyway.
    
    if (!name || amount <= 0) return;
    
    const newLoan = { person, name, amount, paid, rate };
    const uiLoan = { ...newLoan, id: Date.now().toString() };
    loans.push(uiLoan);
    
    document.getElementById('loan-name').value = '';
    document.getElementById('loan-amount').value = '';
    document.getElementById('loan-paid').value = '';
    document.getElementById('loan-rate').value = '';
    
    render();

    const { data, error } = await supabaseClient.from('loans').insert([{ person, name, amount, paid }]).select(); // Omitted rate to match schema actually
    if (data && data.length > 0) {
        const item = data[0];
        const idx = loans.findIndex(l => l.id === uiLoan.id);
        if (idx !== -1) loans[idx] = item;
    } else if (error) {
        console.error('Failed to add loan:', error);
    }

    // Close Modal
    const loanModal = document.getElementById('add-loan-modal');
    if (loanModal) loanModal.style.display = 'none';
}

window.deleteLoan = async function(id) {
    const orig = [...loans];
    loans = loans.filter(l => l.id !== id);
    render();

    const { error } = await supabaseClient.from('loans').delete().eq('id', id);
    if (error) {
        loans = orig;
        render();
        console.error('Failed to delete loan:', error);
    }
}

function renderLoans() {
    loanList.innerHTML = '';
    let totalRemaining = 0;
    
    if (loans.length === 0) {
        loanList.innerHTML = '<div class="empty-state">등록된 대출 내역이 없습니다.</div>';
    } else {
        loans.forEach(l => {
            const paid = l.paid || 0;
            const remaining = Math.max(0, l.amount - paid);
            totalRemaining += remaining;
            
            const progressPercent = Math.min(100, Math.round((paid / l.amount) * 100)) || 0;
            
            let badgeClass = '';
            let label = '';
            if (l.person === 'A') { badgeClass = 'a'; label = '요한'; }
            else if (l.person === 'B') { badgeClass = 'b'; label = '은지'; }
            else { badgeClass = 'common'; label = '공동'; }
            
            let rateHtml = '';
            if (l.rate > 0) {
                rateHtml = `<span class="loan-rate-badge">${l.rate}%</span>`;
            }
            
            const card = document.createElement('div');
            card.className = 'loan-card';
            card.innerHTML = `
                <div class="loan-card-top">
                    <div class="loan-info">
                        <div class="loan-info-header">
                            <span class="person-badge ${badgeClass}">${label}</span>
                            <h4 class="clickable-loan-title" onclick="openLoanModal('${l.id}')" title="상환액 추가하기">${l.name}</h4>
                            ${rateHtml}
                        </div>
                        <div class="loan-amounts-display">
                            <span class="loan-amount">${formatCurrency(remaining)} <small>남음</small></span>
                        </div>
                    </div>
                    <div class="loan-actions">
                        <button class="delete-btn" style="opacity:1;" onclick="deleteLoan('${l.id}')">
                            <i class="ri-close-circle-line"></i>
                        </button>
                    </div>
                </div>
                <div class="loan-progress-container">
                    <div class="loan-progress-bar">
                        <div class="loan-progress-fill" style="width: ${progressPercent}%;"></div>
                    </div>
                    <div class="loan-progress-stats">
                        <span>상환율 ${progressPercent}%</span>
                        <span>총 원금 ${formatCurrency(l.amount)}</span>
                    </div>
                </div>
            `;
            loanList.appendChild(card);
        });
    }
    
    totalLoanAmount.textContent = formatCurrency(totalRemaining);
}

// Initialize Calendar
function initCalendar() {
    document.getElementById('prev-month').addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        renderCalendar();
    });
    
    document.getElementById('next-month').addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        renderCalendar();
    });
}

// Initialize Memo Modal
function initMemoModal() {
    const modal = document.getElementById('memo-modal');
    const closeBtn = document.getElementById('close-modal');
    const saveBtn = document.getElementById('save-memo-btn');
    const goToTxBtn = document.getElementById('go-to-transaction-btn');
    const memoInput = document.getElementById('memo-input');

    const closeModal = () => {
        modal.classList.remove('active');
        activeModalDate = null;
    };

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    saveBtn.addEventListener('click', async () => {
        if (!activeModalDate) return;
        const text = memoInput.value.trim();
        
        if (text) {
            memos[activeModalDate] = text;
            const { error } = await supabaseClient.from('memos').upsert({ date: activeModalDate, content: text });
            if (error) console.error('Failed to save memo:', error);
        } else {
            delete memos[activeModalDate];
            const { error } = await supabaseClient.from('memos').delete().eq('date', activeModalDate);
            if (error) console.error('Failed to delete memo:', error);
        }
        
        renderCalendar();
        closeModal();
    });

    goToTxBtn.addEventListener('click', () => {
        if (!activeModalDate) return;
        
        document.getElementById('date').value = activeModalDate;
        closeModal();
        document.querySelector('[data-tab="tab-transactions"]').click();
        
        // Use a slight delay to allow tab render before focusing
        setTimeout(() => {
            document.getElementById('amount').focus();
        }, 100);
    });
}

// Initialize List Month Selector
function initListMonthSelector() {
    document.getElementById('prev-list-month')?.addEventListener('click', () => {
        currentListMonth--;
        if (currentListMonth < 0) { currentListMonth = 11; currentListYear--; }
        renderList();
    });
    
    document.getElementById('next-list-month')?.addEventListener('click', () => {
        currentListMonth++;
        if (currentListMonth > 11) { currentListMonth = 0; currentListYear++; }
        renderList();
    });
}

// Render Calendar
function renderCalendar() {
    const monthDisplay = document.getElementById('calendar-month-display');
    const daysContainer = document.getElementById('calendar-days');
    
    if (!monthDisplay || !daysContainer) return;

    monthDisplay.textContent = `${currentYear}. ${String(currentMonth + 1).padStart(2, '0')}`;
    daysContainer.innerHTML = '';
    
    const today = new Date();
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    // Empty cells for previous month
    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day empty';
        daysContainer.appendChild(emptyCell);
    }
    
    // Days
    for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day';
        
        const currentDayOfWeek = new Date(currentYear, currentMonth, day).getDay();
        if (currentDayOfWeek === 0) cell.classList.add('sun');
        if (currentDayOfWeek === 6) cell.classList.add('sat');
        
        const isToday = today.getFullYear() === currentYear && today.getMonth() === currentMonth && today.getDate() === day;
        if (isToday) cell.classList.add('today');
        
        const dateString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dailyTxs = transactions.filter(t => t.date === dateString);
        
        const dailyIncome = dailyTxs.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
        const dailyExpense = dailyTxs.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
        
        let contentHtml = `<div class="day-number">${day}</div><div class="day-summary">`;
        
        if (dailyIncome > 0) {
            const shortInc = dailyIncome >= 10000 ? (dailyIncome/10000).toFixed(0) + '만' : dailyIncome.toLocaleString();
            contentHtml += `<div class="day-income">+${shortInc}</div>`;
        }
        if (dailyExpense > 0) {
            const shortExp = dailyExpense >= 10000 ? (dailyExpense/10000).toFixed(0) + '만' : dailyExpense.toLocaleString();
            contentHtml += `<div class="day-expense">-${shortExp}</div>`;
        }
        
        const cellDateObj = new Date(currentYear, currentMonth, day);
        const todayObj = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        
        if (cellDateObj <= todayObj && dailyExpense === 0) {
            contentHtml += `<div class="day-zero">무지출👏</div>`;
        }
        
        // Add Memo Badge if exists
        if (memos[dateString]) {
            contentHtml += `<div class="day-memo" title="${memos[dateString]}"><i class="ri-sticky-note-line"></i> ${memos[dateString]}</div>`;
        }
        
        contentHtml += `</div>`;
        cell.innerHTML = contentHtml;
        
        // Click to open memo modal
        cell.addEventListener('click', () => {
            activeModalDate = dateString;
            document.getElementById('modal-date-title').textContent = `${currentYear}년 ${currentMonth + 1}월 ${day}일`;
            document.getElementById('memo-input').value = memos[dateString] || '';
            document.getElementById('memo-modal').classList.add('active');
            document.getElementById('memo-input').focus();
        });
        
        daysContainer.appendChild(cell);
    }
}

// Initialize Loan Modal
function initLoanModal() {
    const loanModal = document.getElementById('loan-modal');
    const closeBtns = document.querySelectorAll('.close-loan-modal');
    const loanPayForm = document.getElementById('loan-pay-form');
    
    closeBtns.forEach(btn => {
        btn.addEventListener('click', closeLoanModal);
    });
    
    loanModal.addEventListener('click', (e) => {
        if (e.target === loanModal) {
            closeLoanModal();
        }
    });
    
    loanPayForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payAmount = Number(document.getElementById('loan-pay-input').value);
        if (payAmount > 0 && activeLoanId) {
            const loanIndex = loans.findIndex(l => l.id === activeLoanId);
            if (loanIndex !== -1) {
                const currentPaid = loans[loanIndex].paid || 0;
                loans[loanIndex].paid = currentPaid + payAmount;
                const { error } = await supabaseClient.from('loans').update({ paid: loans[loanIndex].paid }).eq('id', activeLoanId);
                if (error) console.error('Failed to update loan paid amount:', error);
                render();
            }
        }
        closeLoanModal();
    });
}

window.openLoanModal = function(id) {
    activeLoanId = id;
    document.getElementById('loan-pay-input').value = '';
    document.getElementById('loan-modal').classList.add('active');
    setTimeout(() => {
        document.getElementById('loan-pay-input').focus();
    }, 100);
}

function closeLoanModal() {
    document.getElementById('loan-modal').classList.remove('active');
}

// ==== Analysis Logic ==== //
function initAnalysis() {
    document.getElementById('prev-analysis-month')?.addEventListener('click', () => {
        currentAnalysisMonth--;
        if (currentAnalysisMonth < 0) { currentAnalysisMonth = 11; currentAnalysisYear--; }
        renderAnalysis();
    });
    
    document.getElementById('next-analysis-month')?.addEventListener('click', () => {
        currentAnalysisMonth++;
        if (currentAnalysisMonth > 11) { currentAnalysisMonth = 0; currentAnalysisYear++; }
        renderAnalysis();
    });
}

function renderAnalysis() {
    const monthDisplay = document.getElementById('analysis-month-display');
    if (!monthDisplay) return;
    
    monthDisplay.textContent = `${currentAnalysisYear}. ${String(currentAnalysisMonth + 1).padStart(2, '0')}`;
    
    // Get Variable txs for current analysis month
    const varMonthTxs = transactions.filter(t => {
        const d = new Date(t.date);
        return d.getFullYear() === currentAnalysisYear && d.getMonth() === currentAnalysisMonth;
    });
    
    // 1. Category Ranking & Savings
    const categories = {};
    let savingsAmount = 0;
    
    varMonthTxs.forEach(t => {
        if (t.category === '저축/투자') {
            savingsAmount += t.amount;
        } else if (t.type === 'expense') {
            const cat = t.category || '기타';
            categories[cat] = (categories[cat] || 0) + t.amount;
        }
    });
    
    // Sort Categories
    const sortedCats = Object.entries(categories)
        .sort((a, b) => b[1] - a[1]);
        
    const catListContainer = document.getElementById('analysis-category-list');
    catListContainer.innerHTML = '';
    
    if (sortedCats.length === 0) {
        catListContainer.innerHTML = `<div class="empty-state">이번 달 지출 내역이 없습니다. (저축/투자 제외)</div>`;
    } else {
        const maxCatAmount = sortedCats[0][1];
        sortedCats.forEach(cat => {
            const pct = Math.max(2, Math.round((cat[1] / maxCatAmount) * 100));
            const itemHtml = `
                <div class="category-item">
                    <div class="category-info">
                        <span class="category-name">${cat[0]}</span>
                        <span class="category-amount">${formatCurrency(cat[1])}</span>
                    </div>
                    <div class="category-bar-bg">
                        <div class="category-bar-fill" style="width: ${pct}%"></div>
                    </div>
                </div>
            `;
            catListContainer.innerHTML += itemHtml;
        });
    }
    
    // Set Savings Amount
    document.getElementById('analysis-savings-amount').textContent = formatCurrency(savingsAmount);
    
    // 2. Trend (Last 6 Months Stacked)
    renderTrendChart();
}

function renderTrendChart() {
    const container = document.getElementById('trend-chart-container');
    if (!container) return;
    container.innerHTML = '';
    
    const monthsData = [];
    let maxTotalExp = 0;
    
    // Using current fixedExpenses for all past months (Simplification for now)
    const fixedExpenseTotal = fixedExpenses.reduce((acc, f) => acc + f.amount, 0);
    
    // Gather past 6 months data based on currently selected Analysis Month
    for (let i = 5; i >= 0; i--) {
        let m = currentAnalysisMonth - i;
        let y = currentAnalysisYear;
        if (m < 0) {
            m += 12;
            y -= 1;
        }
        
        const mtxs = transactions.filter(t => {
            const d = new Date(t.date);
            return d.getFullYear() === y && d.getMonth() === m;
        });
        
        // Exclude savings from variable expense chart? Or include? Let's exclude Savings from general spending trend
        const varExp = Math.abs(mtxs.filter(t => t.type === 'expense' && t.category !== '저축/투자').reduce((acc, t) => acc + t.amount, 0));
        const totalExp = varExp + fixedExpenseTotal;
        
        monthsData.push({ 
            label: `${m + 1}월`, 
            varExp: varExp, 
            fixedExp: fixedExpenseTotal,
            total: totalExp
        });
        
        if (totalExp > maxTotalExp) maxTotalExp = totalExp;
    }
    
    const minHeightPct = 5; // minimum visibility buffer
    
    monthsData.forEach(data => {
        // Calculate heights relative to maximum total expense across 6 months
        const totalPct = maxTotalExp === 0 ? minHeightPct : Math.max(minHeightPct, (data.total / maxTotalExp) * 100);
        
        // Calculate internal segments as percentage of this month's total
        const fixedPct = data.total === 0 ? 0 : (data.fixedExp / data.total) * 100;
        const varPct = data.total === 0 ? 0 : (data.varExp / data.total) * 100;
        
        const shortVal = data.total >= 10000 ? (data.total / 10000).toFixed(0) + '만' : formatCurrency(data.total);
        const detailText = `총 ${formatCurrency(data.total)}<br>변동: ${(data.varExp/10000).toFixed(0)}만 / 고정: ${(data.fixedExp/10000).toFixed(0)}만`;
        
        const wrapper = document.createElement('div');
        wrapper.className = 'trend-bar-wrapper';
        wrapper.innerHTML = `
            <span class="trend-bar-value">${detailText}</span>
            <div class="trend-bar-stack" style="height: ${totalPct}%;">
                <div class="trend-segment var" style="height: ${varPct}%;"></div>
                <div class="trend-segment fixed" style="height: ${fixedPct}%;"></div>
            </div>
            <span class="trend-label">${data.label}</span>
        `;
        container.appendChild(wrapper);
    });
}

// ---- Emoji Setup & Modal ---- //
const COMMON_EMOJIS = ['👛', '💰', '💸', '💎', '💳', '🏦', '📈', '📊', '👨', '👩', '🧑', '👱', '👦', '👧', '👵', '👴', '👶', '🤵', '👰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐶', '🐱', '🐰', '🐸', '🐵', '❤️', '🔥', '👑', '😎', '😍', '🤩', '🤑', '👽', '👻', '🤖', '👾'];
let currentEmojiTarget = null; // 'appLogo', 'personA', 'personB'

function initEmojiModal() {
    // Initial Render of Emojis from state
    const logoIcon = document.getElementById('app-logo-icon');
    if (logoIcon) logoIcon.textContent = appLogoEmoji;
    
    const avatarDashA = document.getElementById('avatar-dash-a');
    if (avatarDashA) avatarDashA.textContent = personAEmoji;
    
    const avatarFixedA = document.getElementById('avatar-fixed-a');
    if (avatarFixedA) avatarFixedA.textContent = personAEmoji;
    
    const avatarDashB = document.getElementById('avatar-dash-b');
    if (avatarDashB) avatarDashB.textContent = personBEmoji;
    
    const avatarFixedB = document.getElementById('avatar-fixed-b');
    if (avatarFixedB) avatarFixedB.textContent = personBEmoji;

    const emojiModal = document.getElementById('emoji-modal');
    if (!emojiModal) return;
    const closeEmojiBtn = emojiModal.querySelector('.close-emoji-modal');
    const emojiGrid = document.getElementById('emoji-grid');

    // Populate grid
    COMMON_EMOJIS.forEach(emoji => {
        const btn = document.createElement('button');
        btn.className = 'emoji-btn';
        btn.textContent = emoji;
        btn.style.cssText = 'background:none; border:none; cursor:pointer; font-size:1.75rem; transition: transform 0.2s; border-radius: 8px; padding: 0.25rem;';
        
        btn.addEventListener('mouseover', () => btn.style.background = 'rgba(255,255,255,0.1)');
        btn.addEventListener('mouseout', () => btn.style.background = 'none');

        btn.addEventListener('click', () => {
            selectEmoji(emoji);
        });
        emojiGrid.appendChild(btn);
    });

    const openModal = (target) => {
        currentEmojiTarget = target;
        emojiModal.classList.add('active');
    };

    const closeModal = () => {
        emojiModal.classList.remove('active');
        currentEmojiTarget = null;
    };

    // Attach click listeners to editable icons
    if (logoIcon) logoIcon.addEventListener('click', () => openModal('appLogo'));
    if (avatarDashA) avatarDashA.addEventListener('click', () => openModal('personA'));
    if (avatarFixedA) avatarFixedA.addEventListener('click', () => openModal('personA'));
    if (avatarDashB) avatarDashB.addEventListener('click', () => openModal('personB'));
    if (avatarFixedB) avatarFixedB.addEventListener('click', () => openModal('personB'));

    if (closeEmojiBtn) closeEmojiBtn.addEventListener('click', closeModal);
    emojiModal.addEventListener('click', (e) => {
        if (e.target === emojiModal) closeModal();
    });
}

async function selectEmoji(emoji) {
    if (currentEmojiTarget === 'appLogo') {
        appLogoEmoji = emoji;
        const logoIcon = document.getElementById('app-logo-icon');
        if (logoIcon) logoIcon.textContent = emoji;
        await supabaseClient.from('app_settings').update({ app_logo: emoji }).eq('id', 1);
    } else if (currentEmojiTarget === 'personA') {
        personAEmoji = emoji;
        const avatarDashA = document.getElementById('avatar-dash-a');
        if (avatarDashA) avatarDashA.textContent = emoji;
        
        const avatarFixedA = document.getElementById('avatar-fixed-a');
        if (avatarFixedA) avatarFixedA.textContent = emoji;
        await supabaseClient.from('app_settings').update({ person_a_emoji: emoji }).eq('id', 1);
    } else if (currentEmojiTarget === 'personB') {
        personBEmoji = emoji;
        const avatarDashB = document.getElementById('avatar-dash-b');
        if (avatarDashB) avatarDashB.textContent = emoji;
        
        const avatarFixedB = document.getElementById('avatar-fixed-b');
        if (avatarFixedB) avatarFixedB.textContent = emoji;
        await supabaseClient.from('app_settings').update({ person_b_emoji: emoji }).eq('id', 1);
    }
    
    // update list view person icon if needed
    renderList();

    const emojiModal = document.getElementById('emoji-modal');
    if (emojiModal) emojiModal.classList.remove('active');
    currentEmojiTarget = null;
}

// Run init
init();
