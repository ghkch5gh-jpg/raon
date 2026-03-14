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
let appTitle = '라온이네';
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
let filterCategoryStr = 'all'; // New Global Category Filter State

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
    return new Intl.NumberFormat('ko-KR', { style: 'decimal' }).format(amount) + '원';
};

// Settlement Period Logic (25th ~ 24th)
function getSettlementPeriod(dateStr) {
    // Force local timezone extraction by manually splitting YYYY-MM-DD
    const parts = dateStr.split('-');
    if (parts.length !== 3) return { year: new Date().getFullYear(), month: new Date().getMonth() };
    
    let stY = parseInt(parts[0], 10);
    let stM = parseInt(parts[1], 10) - 1; // 0-indexed month
    const stD = parseInt(parts[2], 10);
    
    // If day is >= 25, it counts towards the NEXT month's budget
    if (stD >= 25) {
        stM += 1;
        if (stM > 11) {
            stM = 0;
            stY += 1;
        }
    }
    return { year: stY, month: stM };
}

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
        if (fixedData) {
            fixedExpenses = fixedData.map(item => ({...item, desc: item.description}));
        }

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

    // Installment UI Toggle Logic
    const typeIncomeRadio = document.getElementById('type-income');
    const typeExpenseRadio = document.getElementById('type-expense');
    const installmentGroup = document.getElementById('installment-group');
    const isInstallmentCheck = document.getElementById('is-installment');
    const installmentMonthsContainer = document.getElementById('installment-months-container');

    const toggleInstallmentVisibility = () => {
        if (typeExpenseRadio && typeExpenseRadio.checked) {
            installmentGroup.style.display = 'block';
        } else {
            installmentGroup.style.display = 'none';
            isInstallmentCheck.checked = false;
            installmentMonthsContainer.style.display = 'none';
        }
    };
    
    if (typeIncomeRadio) typeIncomeRadio.addEventListener('change', toggleInstallmentVisibility);
    if (typeExpenseRadio) typeExpenseRadio.addEventListener('change', toggleInstallmentVisibility);
    
    if (isInstallmentCheck) {
        isInstallmentCheck.addEventListener('change', (e) => {
            installmentMonthsContainer.style.display = e.target.checked ? 'block' : 'none';
            if (e.target.checked) {
                document.getElementById('installment-months').focus();
            }
        });
    }

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
    
    // Init Data Import Events
    const importForm = document.getElementById('import-form');
    if (importForm) {
        importForm.addEventListener('submit', handleDataImport);
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

    // Keypad Logic
    let currentPin = '';
    const pinDots = document.querySelectorAll('.pin-dot');
    const keypadBtns = document.querySelectorAll('.keypad-btn[data-key]');
    const backspaceBtn = document.getElementById('keypad-backspace');

    const updatePinDisplay = () => {
        pinDots.forEach((dot, index) => {
            if (index < currentPin.length) {
                dot.classList.add('filled');
            } else {
                dot.classList.remove('filled');
            }
        });
    };

    const handlePinInput = (digit) => {
        if (currentPin.length < 4) {
            currentPin += digit;
            updatePinDisplay();
            lockError.style.display = 'none';

            if (currentPin.length === 4) {
                setTimeout(() => verifyPin(), 150); // Small delay to show last dot filled
            }
        }
    };

    const handleBackspace = () => {
        if (currentPin.length > 0) {
            currentPin = currentPin.slice(0, -1);
            updatePinDisplay();
            lockError.style.display = 'none';
        }
    };

    const verifyPin = () => {
        if (currentPin === appPassword) {
            // Success
            sessionStorage.setItem('isAuthenticated', 'true');
            lockScreen.style.display = 'none';
            mainApp.style.display = 'flex';
            render();
        } else {
            // Fail
            lockError.style.display = 'block';
            currentPin = '';
            updatePinDisplay();
            
            // Add shake effect to display wrapper
            const displayWrap = document.getElementById('pin-display');
            displayWrap.style.animation = 'none';
            displayWrap.offsetHeight; /* trigger reflow */
            displayWrap.style.animation = 'shake 0.4s ease-in-out';
        }
    };

    keypadBtns.forEach(btn => {
        btn.addEventListener('click', () => handlePinInput(btn.dataset.key));
    });

    if (backspaceBtn) {
        backspaceBtn.addEventListener('click', handleBackspace);
    }
}

// Update App Password
async function handlePasswordUpdate(e) {
    e.preventDefault();
    const newPwd = document.getElementById('new-password').value.trim();
    if (newPwd.length !== 4) {
        customAlert('비밀번호는 4자리로 입력해주세요.');
        return;
    }

    // Optimistic Update
    appPassword = newPwd;
    document.getElementById('new-password').value = '';
    customAlert('비밀번호가 변경되었습니다!', 'success');

    // DB Update
    const { error } = await supabaseClient.from('app_settings').update({ app_password: appPassword }).eq('id', 1);
    if (error) {
        console.error('Failed to update app password', error);
        customAlert('서버 저장에 실패했습니다. 다음 접속 시 풀릴 수 있습니다.', 'error');
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

            // Toggle FAB visibility based on active tab
            if (targetId === 'tab-transactions') {
                if (fabTx) fabTx.style.display = 'flex';
                if (fabLoan) fabLoan.style.display = 'none';
            } else if (targetId === 'tab-loans') {
                if (fabTx) fabTx.style.display = 'none';
                if (fabLoan) fabLoan.style.display = 'flex';
            } else {
                if (fabTx) fabTx.style.display = 'none';
                if (fabLoan) fabLoan.style.display = 'none';
            }
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
            txModal.classList.add('active');
        });
        
        closeTxBtn.addEventListener('click', () => {
            txModal.classList.remove('active');
        });

        txModal.addEventListener('click', (e) => {
            if (e.target === txModal) txModal.classList.remove('active');
        });
    }

    // Loan Modal
    const loanModal = document.getElementById('add-loan-modal');
    const fabAddLoan = document.getElementById('fab-add-loan');
    const closeLoanBtn = document.querySelector('.close-add-loan-modal');

    if (fabAddLoan && loanModal) {
        fabAddLoan.addEventListener('click', () => {
            loanModal.classList.add('active');
        });

        closeLoanBtn.addEventListener('click', () => {
            loanModal.classList.remove('active');
        });

        loanModal.addEventListener('click', (e) => {
            if (e.target === loanModal) loanModal.classList.remove('active');
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

    const isInstallment = document.getElementById('is-installment') && document.getElementById('is-installment').checked;
    let months = 1;
    if (isInstallment && type === 'expense') {
        const monthsInput = document.getElementById('installment-months');
        months = Number(monthsInput.value);
        if (months < 2 || isNaN(months)) {
            customAlert('할부 개월 수는 최소 2개월 이상 입력해주세요.');
            monthsInput.focus();
            return;
        }
    }

    if (!date || amount <= 0 || !category || !description) {
        customAlert('모든 필드를 올바르게 입력해주세요.');
        return;
    }

    const txsToInsert = [];
    const baseDate = new Date(date);

    if (months > 1) {
        const monthlyAmount = Math.floor(amount / months);
        const remainder = amount % months; // First month gets the rounded remainder if any

        for (let i = 0; i < months; i++) {
            // Calculate next date (exactly one month apart)
            const iterDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, baseDate.getDate());
            
            // Format YYYY-MM-DD
            const yyyy = iterDate.getFullYear();
            const mm = String(iterDate.getMonth() + 1).padStart(2, '0');
            const dd = String(iterDate.getDate()).padStart(2, '0');
            const formattedDate = `${yyyy}-${mm}-${dd}`;

            txsToInsert.push({
                type,
                person,
                date: formattedDate,
                amount: i === 0 ? monthlyAmount + remainder : monthlyAmount,
                category,
                description: `${description} (${i + 1}/${months})`
            });
        }
    } else {
        txsToInsert.push({
            type,
            person,
            date,
            amount,
            category,
            description
        });
    }

    // Optimistic UI update (insert first one locally for immediate feedback)
    const uiTxList = txsToInsert.map(tx => ({ ...tx, id: 'temp-' + Date.now().toString() + Math.random() }));
    transactions.unshift(...uiTxList);
    
    // Reset inputs
    document.getElementById('amount').value = '';
    document.getElementById('description').value = '';
    const isInstallCheckVal = document.getElementById('is-installment');
    if (isInstallCheckVal) {
        isInstallCheckVal.checked = false;
        document.getElementById('installment-months-container').style.display = 'none';
        document.getElementById('installment-months').value = '';
    }
    
    render();

    // Supabase Insert
    const { data, error } = await supabaseClient.from('transactions').insert(txsToInsert).select();
    if (data && data.length > 0) {
        // Reload transactions entirely to ensure correct DB mapping and ordering
        const { data: newTxsData } = await supabaseClient.from('transactions').select('*').order('created_at', { ascending: false });
        if (newTxsData) transactions = newTxsData;
        render();
    } else if (error) {
        console.error('Failed to add transaction(s):', error);
        alert('저장에 실패했습니다.');
    }

    // Close Modal after success
    const txModal = document.getElementById('add-transaction-modal');
    if (txModal) txModal.classList.remove('active');
}

// Delete Transaction
window.deleteTransaction = async function(id) {
    // Optimistic Delete
    const originalTransactions = [...transactions];
    transactions = transactions.filter(t => String(t.id) !== String(id));
    render();

    const { error } = await supabaseClient.from('transactions').delete().eq('id', id);
    if (error) {
        console.error('Failed to delete transaction:', error);
        if (error.code === '22P02') return;
        customAlert('서버 삭제 실패: ' + (error.message || '알 수 없는 오류'), 'error');
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
    
    // Filter by selected person AND selected month AND category string
    let filteredTransactions = transactions.filter(t => {
        const { year: stY, month: stM } = getSettlementPeriod(t.date);
        const matchesMonth = stY === currentListYear && stM === currentListMonth;
        const matchesPerson = filter === 'all' || t.person === filter;
        
        // Expense Category Filter
        let matchesCategory = true;
        if (filterCategoryStr !== 'all') {
            matchesCategory = t.type === 'expense' && (t.category === filterCategoryStr || (t.category == null && filterCategoryStr === '기타'));
        }
        
        return matchesMonth && matchesPerson && matchesCategory;
    });

    // Sort chronologically by date (newest to oldest)
    filteredTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Calculate and update payment summaries (Only Expenses for this month, ignore person filter for sum)
    let sumA = 0;
    let sumB = 0;
    let sumCommon = 0;
    
    transactions.forEach(t => {
        const { year: stY, month: stM } = getSettlementPeriod(t.date);
        if (stY === currentListYear && stM === currentListMonth && t.type === 'expense') {
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
        let emptyHtml = '<div class="empty-state">내역이 없습니다.</div>';
        if (filterCategoryStr !== 'all') {
             emptyHtml = `
             <div class="active-filter-banner glass-panel" style="margin-bottom: 1rem; padding: 0.75rem 1rem; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); display: flex; align-items: center; justify-content: space-between; border-radius: 12px;">
                 <span style="font-weight: 600; color: #1e40af;"><i class="ri-filter-3-line" style="margin-right: 4px;"></i> '${filterCategoryStr}' 모아보기</span>
                 <button type="button" class="icon-btn small clear-cat-filter-btn" style="background: white; color: #ef4444; width: 32px; height: 32px; min-width: 32px; min-height: 32px; padding: 0;"><i class="ri-close-line" style="font-size: 1.25rem;"></i></button>
             </div>
             ` + emptyHtml;
        }
        listEl.innerHTML = emptyHtml;
    } else {
        // If there's an active category filter, inject the banner at the top
        if (filterCategoryStr !== 'all') {
            listEl.innerHTML = `
            <div class="active-filter-banner glass-panel" style="margin-bottom: 1rem; padding: 0.75rem 1rem; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); display: flex; align-items: center; justify-content: space-between; border-radius: 12px;">
                <span style="font-weight: 600; color: #1e40af;"><i class="ri-filter-3-line" style="margin-right: 4px;"></i> '${filterCategoryStr}' 모아보기</span>
                <button type="button" class="icon-btn small clear-cat-filter-btn" style="background: white; color: #ef4444; width: 32px; height: 32px; min-width: 32px; min-height: 32px; padding: 0;"><i class="ri-close-line" style="font-size: 1.25rem;"></i></button>
            </div>
            `;
        }
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
                <div class="item-details" style="min-width: 0; flex: 1;">
                    <span class="item-title" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;">${t.description}</span>
                    <div class="item-meta">
                        <span>${t.date.substring(5).replace('-', '.')}</span>
                        <span>•</span>
                        <span style="color: ${catColor}; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px;">${t.category}</span>
                    </div>
                </div>
            </div>
            <div class="item-right">
                <span class="item-amount ${t.type}">${amountSign} ${formatCurrency(t.amount)}</span>
                <button type="button" class="delete-btn" onclick="deleteTransaction('${t.id}')">
                    <i class="ri-delete-bin-line"></i>
                </button>
            </div>
        `;
        listEl.appendChild(item);
    });

    // Attach event listeners for clearing the category filter, if present
    document.querySelectorAll('.clear-cat-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            filterCategoryStr = 'all';
            renderList();
        });
    });
}

// Update Summaries
function updateSummaries() {
    // Current month filter for Dashboard Summaries
    const today = new Date();
    const currentListYearNum = currentListYear || today.getFullYear();
    const currentListMonthNum = currentListMonth !== undefined ? currentListMonth : today.getMonth();

    // 1. Calculate Variable Expenses
    const monthTxs = transactions.filter(t => {
        const { year: stY, month: stM } = getSettlementPeriod(t.date);
        return stY === currentListYearNum && stM === currentListMonthNum;
    });

    const totalIncome = monthTxs.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    let totalExpense = monthTxs.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

    let aIncome = monthTxs.filter(t => t.type === 'income' && t.person === 'A').reduce((acc, t) => acc + t.amount, 0);
    let aExpense = monthTxs.filter(t => t.type === 'expense' && t.person === 'A').reduce((acc, t) => acc + t.amount, 0);

    let bIncome = monthTxs.filter(t => t.type === 'income' && t.person === 'B').reduce((acc, t) => acc + t.amount, 0);
    let bExpense = monthTxs.filter(t => t.type === 'expense' && t.person === 'B').reduce((acc, t) => acc + t.amount, 0);

    // 2. Add Fixed Expenses to the Totals (Only Total Expense)
    const totalFixed = fixedExpenses.reduce((acc, f) => acc + f.amount, 0);
    totalExpense += totalFixed;

    // 3. Final Balance
    const balance = totalIncome - totalExpense;

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

// Data Import Handler (Excel / Google Sheets)
async function handleDataImport(e) {
    e.preventDefault();
    
    const importType = document.getElementById('import-type').value;
    const yearStr = document.getElementById('import-year').value.trim();
    const rawData = document.getElementById('import-textarea').value.trim();
    const resultMsg = document.getElementById('import-result-msg');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    if (!yearStr || !rawData) return;
    
    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> 처리중...';
        resultMsg.style.color = 'var(--text-main)';
        resultMsg.textContent = '데이터를 분석 중입니다...';

        const lines = rawData.split('\n').filter(line => line.trim() !== '');
        
        let successCount = 0;
        let failCount = 0;
        
        if (importType === 'variable') {
            // 변동 지출 (Variable Expenses)
            // Expected format: Date (M/D) | Description | Amount | Category | Person (optional)
            const newTransactions = [];
            for (const line of lines) {
                const cols = line.split('\t').map(c => c.trim());
                if (cols.length < 3) continue; // Skip malformed lines
                
                // Parse Date (idx 0)
                const datePart = cols[0];
                let month, day;
                if (datePart.includes('/')) {
                    [month, day] = datePart.split('/');
                } else if (datePart.includes('.')) {
                    [month, day] = datePart.split('.');
                } else {
                    continue; // Unrecognized date
                }
                const formattedDate = `${yearStr}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                
                // Parse Description (idx 1)
                const description = cols[1];
                
                // Parse Amount (idx 2)
                let amountStr = cols[2].replace(/[^\d]/g, ''); // Remove commas and spaces and currency signs like ₩
                const amount = parseInt(amountStr, 10);
                if (isNaN(amount) || amount <= 0) continue;

                // Parse Category (idx 3) or default
                const category = cols[3] || '기타';

                // Determine Person (idx 4)
                // "요한", "은지", "부부", etc
                let person = 'Common';
                const pStr = (cols[4] || '').toLowerCase();
                if (pStr.includes('요한') || pStr === 'a') person = 'A';
                else if (pStr.includes('은지') || pStr === 'b') person = 'B';
                
                // Add default type as expense (most common for pasted ledgers)
                newTransactions.push({
                    type: 'expense',
                    person,
                    date: formattedDate,
                    amount,
                    category,
                    description
                });
            }

            if (newTransactions.length > 0) {
                const { data, error } = await supabaseClient.from('transactions').insert(newTransactions).select();
                if (!error && data) {
                    transactions = [...data, ...transactions];
                    successCount = data.length;
                    transactions.sort((a,b) => new Date(b.date) - new Date(a.date)); // Keep sorted
                } else {
                    throw new Error('Supabase 저장 실패 (transactions)');
                }
            }
            
        } else if (importType === 'fixed-a' || importType === 'fixed-b') {
            // 고정 지출 (Fixed Expenses)
            // Expected format: Description | Amount | Note (optional)
            const personTarget = importType === 'fixed-a' ? 'A' : 'B';
            const newFixed = [];
            
            for (const line of lines) {
                const cols = line.split('\t').map(c => c.trim());
                if (cols.length < 2) continue; // Skip malformed
                
                const desc = cols[0];
                let amountStr = cols[1].replace(/[^\d]/g, '');
                const amount = parseInt(amountStr, 10);
                
                if (!desc || isNaN(amount) || amount <= 0) continue;

                newFixed.push({
                    person: personTarget,
                    description: desc,
                    amount: amount
                });
            }

            if (newFixed.length > 0) {
                const { data, error } = await supabaseClient.from('fixed_expenses').insert(newFixed).select();
                if (!error && data) {
                    // Update: Ensure we map `description` to `desc` so the UI renderer (`renderFixed`) doesn't show undefined
                    const correctlyMapped = data.map(item => ({...item, desc: item.description}));
                    fixedExpenses = [...fixedExpenses, ...correctlyMapped];
                    successCount = data.length;
                } else {
                    throw new Error('Supabase 저장 실패 (fixed_expenses)');
                }
            }
        }

        resultMsg.style.color = '#10b981';
        resultMsg.textContent = `가져오기 성공: ${successCount}개의 항목이 등록되었습니다.`;
        document.getElementById('import-textarea').value = ''; // clear
        
        // Update UI
        render();

    } catch (err) {
        console.error('Import Data Error:', err);
        resultMsg.style.color = '#ef4444';
        resultMsg.textContent = `가져오기 실패: 오류가 발생했습니다 (${err.message}). 형식에 맞게 붙여넣었는지 확인해주세요.`;
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="ri-upload-cloud-line"></i> 데이터 가져오기';
    }
}


// Custom Modal Utility
function customAlert(message, type = 'info') {
    const modal = document.getElementById('custom-alert-modal');
    const msgEl = document.getElementById('custom-alert-message');
    const iconEl = document.getElementById('custom-alert-icon');
    const titleEl = document.getElementById('custom-alert-title');
    const btnCancel = document.getElementById('custom-alert-cancel-btn');

    btnCancel.style.display = 'none';
    msgEl.innerHTML = message.replace(/\n/g, '<br>');

    if (type === 'success') {
        iconEl.innerHTML = '<i class="ri-checkbox-circle-fill" style="color: #10b981;"></i>';
        titleEl.textContent = '성공';
    } else if (type === 'error') {
        iconEl.innerHTML = '<i class="ri-error-warning-fill" style="color: #ef4444;"></i>';
        titleEl.textContent = '오류';
    } else {
        iconEl.innerHTML = '<i class="ri-information-fill" style="color: var(--color-person-a);"></i>';
        titleEl.textContent = '알림';
    }

    modal.classList.add('active');

    return new Promise(resolve => {
        const handleOk = () => {
            modal.classList.remove('active');
            document.getElementById('custom-alert-ok-btn').removeEventListener('click', handleOk);
            resolve(true);
        };
        document.getElementById('custom-alert-ok-btn').addEventListener('click', handleOk);
    });
}

function customConfirm(message) {
    const modal = document.getElementById('custom-alert-modal');
    const msgEl = document.getElementById('custom-alert-message');
    const iconEl = document.getElementById('custom-alert-icon');
    const titleEl = document.getElementById('custom-alert-title');
    const btnOk = document.getElementById('custom-alert-ok-btn');
    const btnCancel = document.getElementById('custom-alert-cancel-btn');

    iconEl.innerHTML = '<i class="ri-question-fill" style="color: #f59e0b;"></i>';
    titleEl.textContent = '확인 요청';
    msgEl.innerHTML = message.replace(/\n/g, '<br>');
    btnCancel.style.display = 'block';

    modal.classList.add('active');

    return new Promise(resolve => {
        const handleOk = () => {
            modal.classList.remove('active');
            cleanup();
            resolve(true);
        };
        const handleCancel = () => {
            modal.classList.remove('active');
            cleanup();
            resolve(false);
        };

        const cleanup = () => {
            btnOk.removeEventListener('click', handleOk);
            btnCancel.removeEventListener('click', handleCancel);
        };

        btnOk.addEventListener('click', handleOk);
        btnCancel.addEventListener('click', handleCancel);
    });
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
        customAlert('이미 존재하는 카테고리입니다.', 'error');
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

window.deleteCategory = async function(name) {
    if(customCategories.length <= 1) {
        customAlert('최소 1개의 카테고리는 유지되어야 합니다.', 'error');
        return;
    }
    
    // Check if category name exists
    const targetCat = customCategories.find(c => c.name === name);
    if (!targetCat) return;

    const isConfirmed = await customConfirm(`'${name}' 카테고리를 삭제하시겠습니까?`);
    if (!isConfirmed) return;

    const originalCats = [...customCategories];
    customCategories = customCategories.filter(c => c.name !== name);
    render();

    // Use name for deletion to bypass potential ID/UUID casting issues
    const { error } = await supabaseClient.from('custom_categories').delete().eq('name', name);
    if (error) {
        console.error('Failed to delete category:', error);
        
        // Show error safely on screen
        const listEl = document.getElementById('category-settings-list');
        if (listEl && listEl.parentNode) {
            const errDiv = document.createElement('div');
            errDiv.style.color = '#ef4444';
            errDiv.style.fontSize = '0.85rem';
            errDiv.style.marginTop = '0.5rem';
            errDiv.textContent = '삭제 실패: ' + (error.message || JSON.stringify(error));
            listEl.parentNode.appendChild(errDiv);
            setTimeout(() => errDiv.remove(), 4000);
        }

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
            <button type="button" class="icon-btn small delete-btn" onclick="deleteCategory('${c.name}')" style="opacity: 1; padding: 0.25rem;">
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
    
    // Default to false (unchecked)
    const newFixed = { person, description: desc, amount };
    const uiFixed = { ...newFixed, id: Date.now().toString(), desc, is_checked: false }; 
    
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
    const isConfirmed = await customConfirm('해당 고정 지출을 삭제하시겠습니까?');
    if (!isConfirmed) return;

    const orig = [...fixedExpenses];
    fixedExpenses = fixedExpenses.filter(f => String(f.id) !== String(id));
    render();

    const { error } = await supabaseClient.from('fixed_expenses').delete().eq('id', id);
    if (error) {
        console.error('Failed to delete fixed expense:', error);
        if (error.code === '22P02') return;
        customAlert('고정 지출 삭제 실패: ' + (error.message || '알 수 없는 오류'), 'error');
        fixedExpenses = orig;
        render();
    }
}

// Toggle Checkbox Status
window.toggleFixedCheck = async function(id, isChecked) {
    const idx = fixedExpenses.findIndex(f => String(f.id) === String(id));
    if (idx !== -1) {
        fixedExpenses[idx].is_checked = isChecked;
        
        const { error } = await supabaseClient.from('fixed_expenses').update({ is_checked: isChecked }).eq('id', id);
        if (error) {
            console.error('Failed to update fixed expense check status:', error);
            customAlert('저장에 실패했습니다. 데이터베이스에 is_checked 열(column)이 없거나 권한이 없을 수 있습니다.', 'error');
            fixedExpenses[idx].is_checked = !isChecked; // revert
            renderFixed();
        } else {
            // Re-render nicely upon success without jumping beforehand if not needed.
            renderFixed();
        }
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
                
                const isCheckedStr = f.is_checked ? 'checked' : '';
                const checkedClass = f.is_checked ? 'checked' : '';
                
                const item = document.createElement('div');
                item.className = `fixed-item ${checkedClass}`;
                item.innerHTML = `
                    <div class="fixed-item-left">
                        <input type="checkbox" class="fixed-checkbox" ${isCheckedStr} onchange="toggleFixedCheck('${f.id}', this.checked)">
                        <span class="fixed-desc">${f.desc || f.description}</span>
                    </div>
                    
                    <div class="fixed-item-right" style="flex-shrink: 0;">
                        <span class="fixed-amount">${formatCurrency(f.amount)}</span>
                        <button type="button" class="delete-btn" style="opacity:1;" onclick="deleteFixed('${f.id}')">
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
    if (loanModal) loanModal.classList.remove('active');
}

window.deleteLoan = async function(id) {
    const isConfirmed = await customConfirm('해당 대출 항목을 삭제하시겠습니까? 상환 내역도 함께 삭제됩니다.');
    if (!isConfirmed) return;

    const orig = [...loans];
    loans = loans.filter(l => String(l.id) !== String(id));
    render();

    const { error } = await supabaseClient.from('loans').delete().eq('id', id);
    if (error) {
        console.error('Failed to delete loan:', error);
        if (error.code === '22P02') return;
        customAlert('대출 삭제 실패: ' + (error.message || '알 수 없는 오류'), 'error');
        loans = orig;
        render();
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
                        <button type="button" class="delete-btn" style="opacity:1;" onclick="deleteLoan('${l.id}')">
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
            const shortInc = dailyIncome >= 10000 ? (dailyIncome/10000).toFixed(0) : dailyIncome.toLocaleString();
            contentHtml += `<div class="day-income">+${shortInc}</div>`;
        }
        if (dailyExpense > 0) {
            const shortExp = dailyExpense >= 10000 ? (dailyExpense/10000).toFixed(0) : dailyExpense.toLocaleString();
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
        const { year: stY, month: stM } = getSettlementPeriod(t.date);
        return stY === currentAnalysisYear && stM === currentAnalysisMonth;
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
            const catName = cat[0];
            const pct = Math.max(2, Math.round((cat[1] / maxCatAmount) * 100));
            const itemHtml = `
                <div class="category-item clickable-cat-item" data-cat="${catName}" style="cursor: pointer; padding: 0.25rem; border-radius: 8px; transition: background 0.2s;">
                    <div class="category-info">
                        <span class="category-name">${catName}</span>
                        <span class="category-amount">${formatCurrency(cat[1])}</span>
                    </div>
                    <div class="category-bar-bg">
                        <div class="category-bar-fill" style="width: ${pct}%"></div>
                    </div>
                </div>
            `;
            catListContainer.innerHTML += itemHtml;
        });

        // Add hover styles to document head just in case
        if (!document.getElementById('clickable-cat-styles')) {
            const style = document.createElement('style');
            style.id = 'clickable-cat-styles';
            style.innerHTML = `
                .clickable-cat-item:hover { background: rgba(0, 0, 0, 0.04); }
                .clickable-cat-item:active { background: rgba(0, 0, 0, 0.08); transform: scale(0.98); }
            `;
            document.head.appendChild(style);
        }

        // Attach Click Listeners
        document.querySelectorAll('.clickable-cat-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const clickedCat = e.currentTarget.dataset.cat;
                
                // Set the List's Year/Month to the Analysis's Year/Month
                currentListYear = currentAnalysisYear;
                currentListMonth = currentAnalysisMonth;
                
                // Set Global Filter
                filterCategoryStr = clickedCat;
                
                // Switch Tabs
                const tabBtns = document.querySelectorAll('.tab-btn');
                const tabContents = document.querySelectorAll('.tab-content');
                
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                
                const targetBtn = document.querySelector('.tab-btn[data-tab="tab-transactions"]');
                const targetContent = document.getElementById('tab-transactions');
                
                if (targetBtn) targetBtn.classList.add('active');
                if (targetContent) targetContent.classList.add('active');
                
                // Scroll to top
                window.scrollTo({ top: 0, behavior: 'smooth' });
                
                // Render List
                renderList();
            });
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
            const { year: stY, month: stM } = getSettlementPeriod(t.date);
            return stY === y && stM === m;
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
        
        const shortVal = data.total >= 10000 ? (data.total / 10000).toFixed(0) : formatCurrency(data.total);
        const detailText = `총 ${formatCurrency(data.total)}<br>변동: ${(data.varExp/10000).toFixed(0)} / 고정: ${(data.fixedExp/10000).toFixed(0)}`;
        
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
        
        btn.addEventListener('mouseover', () => btn.style.background = 'rgba(0,0,0,0.05)');
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

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('ServiceWorker registered'))
            .catch(err => console.error('ServiceWorker registration failed', err));
    });
}
